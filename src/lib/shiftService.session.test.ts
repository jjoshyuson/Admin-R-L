import { describe, expect, it, vi } from 'vitest'
const boundary = vi.hoisted(() => ({ rpc: vi.fn(async () => ({ data: { id: 's', shift_id: '2026-10-13-first', business_date: '2026-10-13', shift_type: 'FIRST', employee_id: 'e', employee_name: 'Synthetic', device_id: 'd', clocked_in_at: '2026-10-13T01:00:00Z', status: 'OPEN', schedule_snapshot: {} }, error: null as Error | null })) }))
vi.mock('./supabase/client', () => ({ hasSupabaseConfig: true, requireSupabase: () => ({ rpc: boundary.rpc, from: () => { throw new Error('Non-atomic clock-in mutation') } }) }))
import { openShiftSession } from './shiftService'
describe('clock-in transaction', () => {
  it('opens a session through one atomic server operation', async () => {
    const schedule = { firstShiftStart: '08:00', secondShiftStart: '20:00', timezone: 'Asia/Manila' }
    expect(await openShiftSession({ employeeId: 'e', employeeName: 'Synthetic', deviceId: 'd', schedule })).toMatchObject({ id: 's', employeeId: 'e' })
    expect(boundary.rpc).toHaveBeenCalledWith('clock_in_rnl_session', { p_employee_id: 'e', p_employee_name: 'Synthetic', p_device_id: 'd', p_schedule: schedule })
  })
})
