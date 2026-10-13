import {describe,it,expect,vi,afterEach} from 'vitest'
const boundary=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('../supabase/client',()=>({hasSupabaseConfig:true,requireSupabase:()=>({rpc:boundary.rpc})}))
import {staffClock,attendanceDuration} from './attendanceService'
afterEach(()=>vi.unstubAllGlobals())
describe('staff attendance boundary',()=>{
 it('checks PIN on the server and carries the verified record ID for clock-out',async()=>{
  vi.stubGlobal('navigator',{onLine:true});boundary.rpc.mockResolvedValue({data:{attendance:{id:'record'}},error:null})
  expect(await staffClock({employeeId:'staff',pin:'1234',deviceId:'tablet',action:'clock_out',attendanceId:'record'})).toEqual({id:'record'})
  expect(boundary.rpc).toHaveBeenCalledWith('rnl_staff_clock',{p_employee_id:'staff',p_pin:'1234',p_device_id:'tablet',p_action:'clock_out',p_make_cashier:false,p_attendance_id:'record'})
 })
 it('does not queue or fabricate an offline clock punch',async()=>{
  vi.stubGlobal('navigator',{onLine:false});await expect(staffClock({employeeId:'staff',pin:'1234',deviceId:'tablet',action:'clock_in'})).rejects.toThrow('internet')
 })
 it('counts overtime across midnight without changing the attendance record',()=>{
  expect(attendanceDuration('2026-10-13T00:05:00Z','2026-10-13T12:35:00Z')).toBe('12h 30m')
 })
})
