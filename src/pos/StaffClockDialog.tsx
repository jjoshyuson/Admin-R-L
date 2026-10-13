import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {X,Delete,Clock3,UserRound,LogOut} from 'lucide-react'
import {staffClock,attendanceDuration,type Attendance,type StaffClockAction} from '../lib/pos/attendanceService'

type Staff = {id:string;name:string;isCashier:boolean;isActive:boolean}
type Props = {employees:Staff[];deviceId:string;activeEmployeeId:string;canChangeCashier:boolean;onClose:()=>void;onChanged:(message:string)=>Promise<void>}
export function StaffClockDialog({employees,deviceId,activeEmployeeId,canChangeCashier,onClose,onChanged}:Props) {
 const dialogRef=useRef<HTMLElement>(null)
 const [employeeId,setEmployeeId]=useState(activeEmployeeId)
 const [pin,setPin]=useState('')
 const [verified,setVerified]=useState(false)
 const [attendance,setAttendance]=useState<Attendance|null>(null)
 const [makeCashier,setMakeCashier]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const [now,setNow]=useState(Date.now())
 const employee=employees.find(staff=>staff.id===employeeId)
 const open=attendance&&!attendance.clocked_out_at
 const isCashier=employeeId===activeEmployeeId
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30000);return()=>window.clearInterval(timer)},[])
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null
  dialogRef.current?.querySelector<HTMLElement>(activeEmployeeId?'input':'select')?.focus()
  return()=>{if(previous?.isConnected)previous.focus()}
 },[])
 useEffect(()=>{
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!busy)onClose()
   if(event.key==='Tab'){
    const controls=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')??[]).filter(node=>node.tabIndex>=0&&node.getClientRects().length)
    const first=controls[0],last=controls[controls.length-1]
    if(!first){event.preventDefault();dialogRef.current?.focus();return}
    if(!dialogRef.current?.contains(document.activeElement)){event.preventDefault();first.focus();return}
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
   }
  }
  window.addEventListener('keydown',keyboard)
  return()=>window.removeEventListener('keydown',keyboard)
 },[busy,onClose])

 const time=(stamp:string)=>new Date(stamp).toLocaleTimeString('en-PH',{timeZone:attendance?.schedule_snapshot?.timezone??'Asia/Manila',hour:'2-digit',minute:'2-digit'})
 async function verify() {
  if(busy||!employeeId||pin.length<4)return
  setBusy(true);setError('')
  try {setAttendance(await staffClock({employeeId,pin,deviceId,action:'status'}));setVerified(true)}
  catch(cause){setError(cause instanceof Error?cause.message:'Could not verify PIN.');setPin('')}
  finally{setBusy(false)}
 }
 async function record(action:StaffClockAction) {
  if(busy)return
  if(!canChangeCashier&&((action==='clock_out'&&isCashier)||action==='use_cashier'||(action==='clock_in'&&makeCashier&&employee?.isCashier))) {
   setError('Finish or clear the current order before changing cashier access.');return
  }
  setBusy(true);setError('')
  try {
   const saved=await staffClock({employeeId,pin,deviceId,action,makeCashier:makeCashier&&Boolean(employee?.isCashier),attendanceId:attendance?.id})
   const message=action==='clock_out'?`${employee?.name} clocked out. Other staff attendance stays open.`:action==='use_cashier'?`${employee?.name} is now the active cashier. Attendance stays open.`:`${employee?.name} clocked in${makeCashier&&employee?.isCashier?' and is the active cashier':''}.`
   setAttendance(saved);setSuccess(message);setPin('');await onChanged(message)
  }catch(cause){setError(cause instanceof Error?cause.message:'Could not save attendance. Please retry.')}
  finally{setBusy(false)}
 }
 return createPortal(<div className="staff-clock-backdrop"><section ref={dialogRef} tabIndex={-1} className="staff-clock-dialog" role="dialog" aria-modal="true" aria-label="Staff clock in / out">
  <header><div><span className="staff-clock-kicker">Staff attendance</span><h2>{success?'Attendance saved':verified&&open?'Clock out':verified?'Clock in':'Staff clock in / out'}</h2></div><button type="button" className="staff-clock-icon-button" aria-label="Close staff clock" disabled={busy} onClick={onClose}><X size={20}/></button></header>
  {success?<div className="staff-clock-success" role="status"><Clock3 size={24}/><p>{success}</p>{attendance?<p>{attendance.clocked_out_at?`Clocked out at ${time(attendance.clocked_out_at)}`:`Clocked in at ${time(attendance.clocked_in_at)}`}</p>:null}</div>:<>
   {!verified?<><label className="staff-clock-field"><span>Staff member</span><select value={employeeId} disabled={busy} onChange={event=>{setEmployeeId(event.target.value);setPin('');setError('')}}><option value="">Select staff</option>{employees.filter(staff=>staff.isActive).map(staff=><option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label>
    <label className="staff-clock-field"><span>Enter your PIN</span><input aria-label="Staff PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} disabled={busy} onChange={event=>{setPin(event.target.value.replace(/\D/g,''));setError('')}} onKeyDown={event=>{if(event.key==='Enter')void verify()}}/></label>
    <div className="staff-clock-keypad">{['1','2','3','4','5','6','7','8','9','Delete','0','Clear'].map(key=><button type="button" key={key} disabled={busy} aria-label={key==='Delete'?'Delete PIN digit':key==='Clear'?'Clear PIN':`PIN ${key}`} onClick={()=>{setPin(current=>key==='Delete'?current.slice(0,-1):key==='Clear'?'':(current+key).slice(0,6));setError('')}}>{key==='Delete'?<Delete size={20}/>:key}</button>)}</div><p className="staff-clock-note">Verify your PIN to view and change your attendance.</p></>:<>
    <div className="staff-clock-person"><UserRound size={22}/><div><strong>{employee?.name}</strong><small>{isCashier?'Active cashier on this tablet':open?'Clocked in • attendance only':'Not clocked in'}</small></div><button type="button" disabled={busy} onClick={()=>{setVerified(false);setPin('');setError('')}}>Change staff</button></div>
    {open?<><dl className="staff-clock-summary"><div><dt>Clocked in</dt><dd>{time(attendance.clocked_in_at)}</dd></div><div><dt>Clock out</dt><dd>{time(new Date(now).toISOString())}</dd></div><div><dt>Attendance</dt><dd>{attendanceDuration(attendance.clocked_in_at,new Date(now).toISOString())}</dd></div><div><dt>Assigned shift</dt><dd>{attendance.shift_type==='FIRST'?'First':'Second'} shift · {attendance.business_date}</dd></div></dl><p className="staff-clock-note">Overtime stays on the original shift. Pay is calculated separately.</p><div className="staff-clock-info">{isCashier?'Clocking out locks cashier access on this tablet.':'Clocking out will not affect the active cashier.'} Other staff remain clocked in.</div>{employee?.isCashier&&!isCashier?<button type="button" className="staff-clock-secondary" disabled={busy||!canChangeCashier} onClick={()=>void record('use_cashier')}>Use this tablet as cashier</button>:null}</>:<><p className="staff-clock-note">Clock-in time is recorded by the server when you confirm.</p>{employee?.isCashier?<label className="staff-clock-checkbox"><input type="checkbox" checked={makeCashier} disabled={busy||!canChangeCashier} onChange={event=>setMakeCashier(event.target.checked)}/>Make active cashier on this tablet</label>:null}<div className="staff-clock-info">Attendance is separate from cashier access. Other staff will not be signed out. Choose active cashier to unlock ordering.</div></>}
   </>}
  </>}
  {error?<p className="staff-clock-error" role="alert">{error}</p>:null}
  <footer>{success?<button type="button" className="staff-clock-primary" onClick={onClose}>Done</button>:<><button type="button" className="staff-clock-secondary" disabled={busy} onClick={onClose}>{verified&&open?'Keep working':'Cancel'}</button><button type="button" className="staff-clock-primary" disabled={busy||(!verified&&(!employeeId||pin.length<4))} onClick={()=>void(verified?record(open?'clock_out':'clock_in'):verify())}>{busy?(verified?'Saving…':'Checking PIN…'):!verified?'Verify PIN':open?<><LogOut size={18}/>{isCashier?'Clock out & lock POS':'Confirm clock out'}</>:'Confirm clock in'}</button></>}</footer>
 </section></div>,document.body)
}
