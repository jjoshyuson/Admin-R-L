import { hasSupabaseConfig, requireSupabase } from '../supabase/client'
export type Attendance = {
 id: string; employee_id: string; employee_name: string; business_date: string; shift_type: 'FIRST'|'SECOND';
 shift_id: string; clocked_in_at: string; clocked_out_at: string|null; schedule_snapshot: {timezone?:string}
}
export type StaffClockAction = 'status'|'clock_in'|'clock_out'|'use_cashier'
export async function staffClock(input: {employeeId:string;pin:string;deviceId:string;action:StaffClockAction;makeCashier?:boolean;attendanceId?:string}): Promise<Attendance|null> {
 if (!hasSupabaseConfig || !navigator.onLine) throw new Error('Connect to the internet to record attendance.')
 const {data,error}=await requireSupabase().rpc('rnl_staff_clock',{
  p_employee_id:input.employeeId,p_pin:input.pin,p_device_id:input.deviceId,p_action:input.action,
  p_make_cashier:input.makeCashier??false,p_attendance_id:input.attendanceId??null,
 })
 if(error)throw new Error(error.message)
 return (data as {attendance:Attendance|null}).attendance
}
export function attendanceDuration(start:string,end:string=new Date().toISOString()) {
 const minutes=Math.max(0,Math.floor((new Date(end).getTime()-new Date(start).getTime())/60000))
 return `${Math.floor(minutes/60)}h ${minutes%60}m`
}

export async function fetchStaffDirectory(): Promise<Record<string,unknown>> {
 if (!hasSupabaseConfig) return {employees:[]}
 const {data,error}=await requireSupabase().rpc('rnl_pos_staff_directory')
 if(error)throw new Error(error.message)
 return data as Record<string,unknown>
}
