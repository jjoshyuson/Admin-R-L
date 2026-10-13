import {test,expect} from '@playwright/test'
test('dashboard exposes icon toggle and pulse on zero-valued trend',async({page})=>{
 await page.route('**/rest/v1/**',r=>r.request().method()==='GET'||r.request().url().endsWith('/rnl_pos_staff_directory')?r.continue():r.abort())
 await page.goto('/');await expect(page.getByRole('button',{name:'Toggle color theme'})).toBeVisible()
 await expect(page.locator('.chart-strand-glow')).toHaveCount(1,{timeout:15000})
 await expect(page.getByRole('combobox',{name:'Appearance'})).toHaveCount(0)
})
test('category settings and shift reports use themed controls and vector icons',async({page})=>{
 await page.route('**/rest/v1/**',r=>r.request().method()==='GET'||r.request().url().endsWith('/rnl_pos_staff_directory')?r.continue():r.abort())
 await page.goto('/');await page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name:'Daily Log',exact:true}).click()
 await page.getByRole('button',{name:'Daily log category settings',exact:true}).click()
 await expect(page.locator('.daily-log-category-row .category-row-copy').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
 await page.goto('/');await page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name:'More',exact:true}).click()
 await page.getByRole('button',{name:/^Shift Reports/}).click()
 await expect(page.locator('.shift-metric-grid')).toHaveCSS('row-gap','16px')
 await expect(page.locator('.shift-metric-row').first()).toHaveCSS('border-radius','12px')
 await expect(page.locator('.shift-report-tabs svg')).toHaveCount(3)
 await expect(page.locator('.shift-metric-grid .shift-metric-icon svg')).toHaveCount(6,{timeout:15000})
})
