import {test,expect} from '@playwright/test'
test('locked POS opens a staff PIN dialog without clocking anyone in',async({page})=>{
 await page.route('**/rest/v1/**',r=>r.request().method()==='GET'||r.request().url().endsWith('/rnl_pos_staff_directory')?r.continue():r.abort())
 await page.goto('/pos.html');await page.getByRole('button',{name:'Staff clock in / out',exact:true}).last().click()
 await expect(page.getByRole('dialog',{name:'Staff clock in / out'})).toBeVisible()
 await expect(page.getByRole('textbox',{name:'Staff PIN'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Verify PIN',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'Close staff clock',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Staff clock in / out'})).toHaveCount(0)
})
async function fixtureStaff(page:import('@playwright/test').Page,initiallyOpen=false) {
 let open=initiallyOpen
 const calls:Array<Record<string,unknown>>=[]
 const attendance={id:'00000000-0000-4000-8000-000000000020',employee_id:'synthetic-staff',employee_name:'Synthetic staff',business_date:'2026-10-13',shift_type:'FIRST',shift_id:'2026-10-13-first',clocked_in_at:'2026-10-13T00:05:00Z',clocked_out_at:null,schedule_snapshot:{timezone:'Asia/Manila'}}
 await page.route('**/rest/v1/**',r=>r.request().method()==='GET'||r.request().url().endsWith('/rnl_pos_staff_directory')?r.continue():r.abort())
 await page.route('**/rest/v1/admin_settings**',async r=>{
  if(r.request().method()!=='GET')return r.abort()
  const response=await r.fetch();const rows=await response.json();const url=new URL(r.request().url())
  const value={employees:[{id:'synthetic-staff',name:'Synthetic staff',isActive:true,isCashier:true}]}
  const fixture=Array.isArray(rows)?rows.map(row=>(row.key==='employees'||url.searchParams.get('key')==='eq.employees')?{...row,value}:row):url.searchParams.get('key')==='eq.employees'?{...rows,value}:rows
  await r.fulfill({response,json:fixture})
 })
 await page.route('**/rest/v1/rpc/rnl_pos_staff_directory',r=>r.fulfill({json:{employees:[{id:'synthetic-staff',name:'Synthetic staff',isActive:true,isCashier:true}]}}))
 await page.route('**/rest/v1/shift_sessions?**',r=>r.fulfill({json:[]}))
 await page.route('**/rest/v1/rpc/rnl_staff_clock',r=>{
  const body=r.request().postDataJSON();calls.push(body)
  if(body.p_action==='status')return r.fulfill({json:{attendance:open?attendance:null}})
  if(body.p_action==='clock_in'){open=true;return r.fulfill({json:{attendance}})}
  if(body.p_action==='clock_out'){open=false;return r.fulfill({json:{attendance:{...attendance,clocked_out_at:'2026-10-13T12:35:00Z'}}})}
  return r.fulfill({json:{attendance}})
 })
 return calls
}
test('staff clock-in requires verified PIN and explicit confirmation',async({page})=>{
 const calls=await fixtureStaff(page)
 await page.goto('/pos.html');await page.getByRole('button',{name:'Staff clock in / out',exact:true}).last().click()
 await page.getByRole('dialog').getByRole('combobox').selectOption('synthetic-staff')
 await page.getByRole('textbox',{name:'Staff PIN'}).fill('1234')
 await page.getByRole('button',{name:'Verify PIN',exact:true}).click()
 await expect(page.getByRole('button',{name:'Confirm clock in',exact:true})).toBeVisible()
 expect(calls.map(x=>x.p_action)).toEqual(['status'])
 await expect(page.getByRole('checkbox',{name:'Make active cashier on this tablet'})).not.toBeChecked()
 await page.getByRole('button',{name:'Confirm clock in',exact:true}).click()
 await expect(page.getByRole('dialog').getByText('Synthetic staff clocked in.',{exact:true})).toBeVisible()
 expect(calls[1]).toMatchObject({p_action:'clock_in',p_make_cashier:false,p_pin:'1234'})
})
test('clock-out review preserves the original shift and sends its exact attendance ID',async({page})=>{
 const calls=await fixtureStaff(page,true)
 await page.goto('/pos.html');await page.getByRole('button',{name:'Staff clock in / out',exact:true}).last().click()
 await page.getByRole('dialog').getByRole('combobox').selectOption('synthetic-staff')
 await page.getByRole('textbox',{name:'Staff PIN'}).fill('1234')
 await page.getByRole('button',{name:'Verify PIN',exact:true}).click()
 await expect(page.getByText('First shift · 2026-10-13',{exact:true})).toBeVisible()
 expect(calls.map(x=>x.p_action)).toEqual(['status'])
 await page.getByRole('button',{name:'Confirm clock out',exact:true}).click()
 await expect(page.getByText('Clocked out at 08:35 PM',{exact:true})).toBeVisible()
 expect(calls[1]).toMatchObject({p_action:'clock_out',p_attendance_id:'00000000-0000-4000-8000-000000000020'})
})
