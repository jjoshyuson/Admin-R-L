import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Plus, ReceiptText, ShieldCheck, WalletCards, X } from 'lucide-react'
import { fetchAdminSetting, saveAdminSetting } from './lib/adminApi'
import { createRandomId } from './lib/randomId'
import { appendTransaction, calculateShiftAmount, employeeBalance, hasEmployeeOnDate } from './lib/workVault'
import type { VaultTransaction, WorkVaultShift } from './lib/workVault'
import './workVault.css'

type Employee = { id: string; name: string; dailyRate: number; isCashier: boolean; isActive: boolean }
type View = 'schedule' | 'vaults'
type ShiftDraft = { date: string; employeeIds: string[]; overtimeHours: number; notes: string }

const money = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount)
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const dateFromIso = (value: string) => new Date(`${value}T12:00:00`)
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()

function normalizeEmployees(setting: Record<string, unknown> | null): Employee[] {
  const values = Array.isArray(setting?.employees) ? setting.employees : []
  return values.map((value) => value as Record<string, unknown>).map((item, index) => ({
    id: String(item.id ?? `employee-${index}`), name: String(item.name ?? 'Employee'), dailyRate: Math.max(0, Number(item.dailyRate ?? item.daily_rate ?? 0)),
    isCashier: item.isCashier !== false && item.is_cashier !== false, isActive: item.isActive !== false && item.is_active !== false,
  }))
}

function normalizeTracker(setting: Record<string, unknown> | null) {
  const rawShifts = Array.isArray(setting?.workVaultShifts) ? setting.workVaultShifts : []
  const rawTransactions = Array.isArray(setting?.transactions) ? setting.transactions : []
  let shifts = rawShifts.map((value) => {
    const shift = value as WorkVaultShift
    return { ...shift, shiftLength: 'full' as const, hours: 'Full day', attendanceStatus: shift.attendanceStatus ?? (shift.attendedAt ? 'attended' : 'scheduled'), attendedAt: shift.attendedAt ?? null }
  })
  let transactions = rawTransactions as VaultTransaction[]
  if (!shifts.length && Array.isArray(setting?.attendance)) {
    for (const value of setting.attendance) {
      const item = value as Record<string, unknown>
      const shift: WorkVaultShift = {
        id: String(item.id), businessDate: String(item.businessDate ?? item.business_date), employeeId: String(item.employeeId ?? item.employee_id),
        employeeName: String(item.employeeName ?? item.employee_name), role: 'Team member', dailyRate: Number(item.dailyRate ?? item.daily_rate ?? 0),
        shiftLength: 'full', overtimeHours: 0, notes: 'Imported from the previous schedule tracker', hours: 'Full day', amount: Number(item.dailyRate ?? item.daily_rate ?? 0),
        confirmedAt: String(item.recordedAt ?? item.recorded_at ?? new Date().toISOString()), attendanceStatus: 'attended', attendedAt: String(item.recordedAt ?? item.recorded_at ?? new Date().toISOString()),
      }
      shifts = [...shifts, shift]
      transactions = appendTransaction(transactions, { id: `tx-${shift.id}`, employeeId: shift.employeeId, date: shift.businessDate, type: 'shift', amount: shift.amount, shiftId: shift.id, note: shift.notes, createdAt: shift.confirmedAt })
    }
  }
  return { shifts, transactions }
}

export function WorkVault({ onBack }: { onBack: () => void }) {
  const today = isoDate(new Date())
  const [view, setView] = useState<View>('schedule')
  const [weekAnchor, setWeekAnchor] = useState(today)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<WorkVaultShift[]>([])
  const [transactions, setTransactions] = useState<VaultTransaction[]>([])
  const [draft, setDraft] = useState<ShiftDraft | null>(null)
  const [expandedVault, setExpandedVault] = useState<string | null>(null)
  const [ledgerAction, setLedgerAction] = useState<{ employee: Employee; type: 'advance' | 'payment' } | null>(null)
  const [ledgerAmount, setLedgerAmount] = useState('')
  const [ledgerNote, setLedgerNote] = useState('')
  const [status, setStatus] = useState('Loading…')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([fetchAdminSetting('employees'), fetchAdminSetting('salary_tracker')]).then(([employeeSetting, trackerSetting]) => {
      if (!active) return
      const savedEmployees = localStorage.getItem('admin-web-employees')
      const nextEmployees = normalizeEmployees(employeeSetting ?? (savedEmployees ? JSON.parse(savedEmployees) as Record<string, unknown> : null))
      const local = localStorage.getItem('admin-web-salary-tracker')
      const source = trackerSetting ?? (local ? JSON.parse(local) as Record<string, unknown> : null)
      const normalized = normalizeTracker(source)
      setEmployees(nextEmployees); setShifts(normalized.shifts); setTransactions(normalized.transactions); setStatus('Up to date')
    }).catch(() => {
      const savedEmployees = localStorage.getItem('admin-web-employees')
      const savedTracker = localStorage.getItem('admin-web-salary-tracker')
      setEmployees(normalizeEmployees(savedEmployees ? JSON.parse(savedEmployees) as Record<string, unknown> : null))
      const normalized = normalizeTracker(savedTracker ? JSON.parse(savedTracker) as Record<string, unknown> : null)
      setShifts(normalized.shifts); setTransactions(normalized.transactions); setStatus('Using saved browser data')
    })
    return () => { active = false }
  }, [])

  async function persist(nextShifts: WorkVaultShift[], nextTransactions: VaultTransaction[], message: string) {
    setSaving(true); setShifts(nextShifts); setTransactions(nextTransactions)
    const payload = { workVaultShifts: nextShifts, transactions: nextTransactions }
    localStorage.setItem('admin-web-salary-tracker', JSON.stringify(payload))
    try { await saveAdminSetting('salary_tracker', payload); setStatus(message) }
    catch { setStatus(`${message} · saved on this device`) }
    finally { setSaving(false) }
  }

  const week = useMemo(() => {
    const anchor = dateFromIso(weekAnchor); const weekday = anchor.getDay(); const mondayOffset = weekday === 0 ? -6 : 1 - weekday
    const monday = new Date(anchor); monday.setDate(anchor.getDate() + mondayOffset)
    return Array.from({ length: 7 }, (_, index) => { const day = new Date(monday); day.setDate(monday.getDate() + index); return isoDate(day) })
  }, [weekAnchor])
  const activeEmployees = employees.filter((employee) => employee.isActive)
  const totalOwed = activeEmployees.reduce((sum, employee) => sum + employeeBalance(transactions, employee.id), 0)

  function openShift(date: string) { setDraft({ date, employeeIds: [], overtimeHours: 0, notes: '' }) }
  function shiftPreview(employee: Employee) { return calculateShiftAmount(employee.dailyRate, 'full', draft?.overtimeHours ?? 0) }
  function confirmShifts() {
    if (!draft || !draft.employeeIds.length) return
    const duplicates = draft.employeeIds.filter((id) => hasEmployeeOnDate(shifts, id, draft.date))
    if (duplicates.length) { setStatus('An employee can only be added once per date.'); return }
    const confirmedAt = new Date().toISOString()
    const additions = draft.employeeIds.map((id) => {
      const employee = activeEmployees.find((item) => item.id === id)!
      const amount = shiftPreview(employee); const shiftId = createRandomId('work-shift')
      return { id: shiftId, businessDate: draft.date, employeeId: employee.id, employeeName: employee.name, role: employee.isCashier ? 'Cashier' : 'Team member', dailyRate: employee.dailyRate, shiftLength: 'full', overtimeHours: draft.overtimeHours, notes: draft.notes, hours: 'Full day', amount, confirmedAt, attendanceStatus: 'scheduled', attendedAt: null } satisfies WorkVaultShift
    })
    void persist([...shifts, ...additions], transactions, `${additions.length} employee${additions.length === 1 ? '' : 's'} scheduled`); setDraft(null)
  }

  function confirmAttendance(shift: WorkVaultShift) {
    if (shift.attendanceStatus === 'attended') return
    const attendedAt = new Date().toISOString()
    const nextShifts = shifts.map((item) => item.id === shift.id ? { ...item, attendanceStatus: 'attended' as const, attendedAt } : item)
    const nextTransactions = appendTransaction(transactions, { id: createRandomId('vault-entry'), employeeId: shift.employeeId, date: shift.businessDate, type: 'shift', amount: shift.amount, shiftId: shift.id, note: shift.notes, createdAt: attendedAt })
    void persist(nextShifts, nextTransactions, `${shift.employeeName}'s attendance confirmed`)
  }

  function removeScheduledEmployee(shift: WorkVaultShift) {
    if (shift.attendanceStatus === 'attended') { setStatus('Attended shifts cannot be deleted. Create an adjustment in the vault instead.'); return }
    void persist(shifts.filter((item) => item.id !== shift.id), transactions, `${shift.employeeName} removed from the schedule`)
  }

  function recordLedgerAction() {
    if (!ledgerAction) return
    const amount = Math.abs(Number(ledgerAmount)); if (!amount) return
    const signedAmount = ledgerAction.type === 'advance' ? amount : -amount
    const next = appendTransaction(transactions, { id: createRandomId('vault-entry'), employeeId: ledgerAction.employee.id, date: today, type: ledgerAction.type, amount: signedAmount, shiftId: null, note: ledgerNote, createdAt: new Date().toISOString() })
    void persist(shifts, next, `${ledgerAction.type === 'advance' ? 'Advance' : 'Payment'} recorded`); setLedgerAction(null); setLedgerAmount(''); setLedgerNote('')
  }

  return <div className="workvault-shell">
    <header className="wv-topbar"><button onClick={onBack} aria-label="Back to admin"><ChevronLeft /></button><div><span>WORKVAULT</span><small>{saving ? 'Saving…' : status}</small></div><span className="wv-topbar-spacer" aria-hidden="true" /></header>
    <main className="wv-main">
      {view === 'schedule' && <>
        <section className="wv-title"><div><p>TEAM ROSTER</p><h1>Schedule</h1></div><button onClick={() => openShift(today)}><Plus /> Add shift</button></section>
        <section className="wv-weekbar"><button onClick={() => { const d = dateFromIso(week[0]); d.setDate(d.getDate() - 7); setWeekAnchor(isoDate(d)) }}><ChevronLeft /></button><div><span>WEEK OF</span><strong>{dateFromIso(week[0]).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} — {dateFromIso(week[6]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong></div><button onClick={() => { const d = dateFromIso(week[0]); d.setDate(d.getDate() + 7); setWeekAnchor(isoDate(d)) }}><ChevronRight /></button></section>
        <div className="wv-roster">{week.map((date) => { const dayShifts = shifts.filter((shift) => shift.businessDate === date); const dayTotal = dayShifts.filter((shift) => shift.attendanceStatus === 'attended').reduce((sum, shift) => sum + shift.amount, 0); const day = dateFromIso(date); return <section className={`wv-day ${date === today ? 'is-today' : ''}`} key={date}>
          <button className="wv-date" onClick={() => openShift(date)}><strong>{day.getDate()}</strong><span>{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>{date === today && <em>TODAY</em>}</button>
          <div className="wv-daybody"><button className="wv-daymeta" onClick={() => openShift(date)}><span>{dayShifts.length} scheduled</span><strong>{money(dayTotal)} confirmed</strong></button>
            {dayShifts.map((shift) => <article className={`wv-shift ${shift.attendanceStatus === 'attended' ? 'is-attended' : ''}`} key={shift.id}><span className="wv-avatar">{initials(shift.employeeName)}</span><div><strong>{shift.employeeName}</strong><small>{shift.role} · Full day{shift.overtimeHours ? ` + ${shift.overtimeHours}h OT` : ''}</small><span className={`wv-attendance-label is-${shift.attendanceStatus}`}>{shift.attendanceStatus === 'attended' ? 'Attendance confirmed' : 'Awaiting attendance'}</span></div><em>{money(shift.amount)}</em><div className="wv-shift-actions">{shift.attendanceStatus === 'scheduled' && <><button className="wv-attend-button" onClick={() => confirmAttendance(shift)}>Confirm attended</button><button className="wv-remove-button" onClick={() => removeScheduledEmployee(shift)}>Remove</button></>}</div></article>)}
            {!dayShifts.length && <button className="wv-empty" onClick={() => openShift(date)}><Plus /> Assign a shift</button>}
          </div></section> })}</div>
      </>}
      {view === 'vaults' && <><section className="wv-title"><div><p>SALARY CURRENTLY OWED</p><h1>Employee vaults</h1></div></section><section className="wv-owed"><span>TOTAL OWED</span><strong>{money(totalOwed)}</strong><small>Across {activeEmployees.length} active employees</small></section><div className="wv-vault-list">{activeEmployees.map((employee) => { const balance = employeeBalance(transactions, employee.id); const history = transactions.filter((item) => item.employeeId === employee.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); return <article className="wv-vault" key={employee.id}><button className="wv-vault-head" onClick={() => setExpandedVault(expandedVault === employee.id ? null : employee.id)}><span className="wv-avatar">{initials(employee.name)}</span><div><strong>{employee.name}</strong><small>{employee.isCashier ? 'Cashier' : 'Team member'}</small></div><em>{money(balance)}</em><ChevronDown className={expandedVault === employee.id ? 'is-open' : ''} /></button>{expandedVault === employee.id && <div className="wv-history"><div className="wv-ledger-actions"><button onClick={() => setLedgerAction({ employee, type: 'advance' })}>Add advance</button><button onClick={() => setLedgerAction({ employee, type: 'payment' })}>Record payment</button></div>{history.map((item) => <div className="wv-transaction" key={item.id}><span className={item.amount < 0 ? 'is-deduction' : ''}>{item.type === 'shift' ? <Clock3 /> : <ReceiptText />}</span><div><strong>{item.type.replace(/^./, (char) => char.toUpperCase())} · {dateFromIso(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong><small>{item.note || (item.shiftId ? `Shift ${item.shiftId.slice(-6)}` : 'Recorded transaction')} · Balance {money(item.resultingBalance)}</small></div><em className={item.amount < 0 ? 'is-deduction' : ''}>{item.amount > 0 ? '+' : '−'}{money(Math.abs(item.amount))}</em></div>)}</div>}</article> })}</div></>}
    </main>
    <nav className="wv-nav" aria-label="WorkVault navigation">{([{ id: 'schedule', label: 'Schedule', icon: CalendarDays }, { id: 'vaults', label: 'Vaults', icon: WalletCards }] as const).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'is-active' : ''} onClick={() => setView(id)}><Icon /><span>{label}</span></button>)}</nav>

    {draft && <div className="wv-modalback"><section className="wv-modal" role="dialog" aria-modal="true"><header><div><p>ASSIGN SHIFT</p><h2>{dateFromIso(draft.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div><button onClick={() => setDraft(null)} aria-label="Close"><X /></button></header><div className="wv-modalbody"><label className="wv-field"><span>ADD EMPLOYEE</span><select value="" onChange={(event) => { const id = event.target.value; if (id && !draft.employeeIds.includes(id)) setDraft({ ...draft, employeeIds: [...draft.employeeIds, id] }) }}><option value="">Select an employee…</option>{activeEmployees.filter((employee) => !draft.employeeIds.includes(employee.id) && !hasEmployeeOnDate(shifts, employee.id, draft.date)).map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {money(employee.dailyRate)} / day</option>)}</select></label><section className="wv-scheduled-field"><span>SCHEDULED EMPLOYEES</span><div className="wv-scheduled-list">{draft.employeeIds.map((id) => { const employee = activeEmployees.find((item) => item.id === id)!; return <article key={id}><span className="wv-avatar">{initials(employee.name)}</span><div><strong>{employee.name}</strong><small>Full day · {money(shiftPreview(employee))}</small></div><button onClick={() => setDraft({ ...draft, employeeIds: draft.employeeIds.filter((item) => item !== id) })}>Remove</button></article>})}{!draft.employeeIds.length && <p>No employees scheduled yet.</p>}</div></section><label className="wv-field"><span>OVERTIME (HOURS)</span><input type="number" min="0" step="0.5" value={draft.overtimeHours} onChange={(event) => setDraft({ ...draft, overtimeHours: Math.max(0, Number(event.target.value)) })} /></label><label className="wv-field"><span>NOTES (OPTIONAL)</span><textarea maxLength={120} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Add a note for this shift…" /></label><section className="wv-confirm-total"><span>EXPECTED AFTER ATTENDANCE</span><strong>{money(draft.employeeIds.reduce((sum, id) => sum + shiftPreview(activeEmployees.find((item) => item.id === id)!), 0))}</strong>{draft.employeeIds.map((id) => { const employee = activeEmployees.find((item) => item.id === id)!; return <small key={id}>{employee.name} <em>{money(shiftPreview(employee))}</em></small>})}</section></div><footer><button className="wv-confirm" disabled={!draft.employeeIds.length || saving} onClick={confirmShifts}><ShieldCheck /> Save schedule</button><small>Scheduling does not add earnings. Confirm attendance from the roster after the shift.</small></footer></section></div>}
    {ledgerAction && <div className="wv-modalback"><section className="wv-modal wv-smallmodal"><header><div><p>{ledgerAction.type === 'advance' ? 'BALANCE ADDITION' : 'COMPLETED PAYMENT'}</p><h2>{ledgerAction.type === 'advance' ? 'Add advance' : 'Record payment'}</h2></div><button onClick={() => setLedgerAction(null)}><X /></button></header><div className="wv-modalbody"><p className="wv-balance-note">Current balance <strong>{money(employeeBalance(transactions, ledgerAction.employee.id))}</strong></p><label className="wv-field"><span>AMOUNT</span><input autoFocus inputMode="decimal" value={ledgerAmount} onChange={(event) => setLedgerAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" /></label><label className="wv-field"><span>NOTE (OPTIONAL)</span><textarea value={ledgerNote} onChange={(event) => setLedgerNote(event.target.value)} /></label></div><footer><button className="wv-confirm is-coral" disabled={!Number(ledgerAmount)} onClick={recordLedgerAction}>{ledgerAction.type === 'advance' ? 'Add to balance' : 'Record deduction'}</button></footer></section></div>}
  </div>
}
