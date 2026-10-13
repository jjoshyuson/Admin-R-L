import {test,expect} from '@playwright/test'
test.beforeEach(async({page})=>{await page.route('**/rest/v1/**',route=>['POST','PUT','PATCH','DELETE'].includes(route.request().method())&&!route.request().url().endsWith('/rnl_pos_staff_directory')?route.abort():route.continue())})
test('shared appearance persists and replaces duplicate navigation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/')
 await expect(page.getByRole('navigation',{name:'Admin workspace'})).toHaveCount(0)
 await page.getByRole('button',{name:'Toggle color theme'}).click()
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 await page.goto('/pos.html');await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 await page.getByRole('button',{name:'Toggle color theme'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light')
})
test('desktop retains primary navigation without routine sync',async({page})=>{
 await page.goto('/');await expect(page.getByRole('navigation',{name:'Primary'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Refresh live admin data',exact:true})).toHaveCount(0)
 await page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name:'More',exact:true}).click()
 await expect(page.getByRole('button',{name:/^Menu Settings/})).toBeVisible()
})
test('collapsed tablet theme control does not overlap the menu',async({page})=>{
 await page.setViewportSize({width:1280,height:800});await page.goto('/pos.html')
 await page.getByRole('button',{name:'Toggle color theme'}).click()
 await page.getByRole('button',{name:'Collapse navigation'}).click()
 await expect.poll(async()=>(await page.locator('.pos-sidebar').boundingBox())?.width ?? 0).toBeLessThanOrEqual(90)
 await expect(page.getByRole('button',{name:'Toggle color theme'})).toBeVisible()
 const contrast=await page.getByRole('button',{name:/^Dine In$/i}).evaluate(el=>{
  const s=getComputedStyle(el),rgb=(v:string)=>v.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n=>{const a=n/255;return a<=.04045?a/12.92:Math.pow((a+.055)/1.055,2.4)})
  const luminance=(v:string)=>{const [r,g,b]=rgb(v);return .2126*r+.7152*g+.0722*b}
  const a=luminance(s.color),b=luminance(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
 });expect(contrast).toBeGreaterThanOrEqual(4.5)
})
test('desktop last settings action clears the fixed navigation',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/')
 await page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name:'More',exact:true}).click()
 const reset=page.getByRole('button',{name:/^Reset Data/});await reset.scrollIntoViewIfNeeded()
 await page.evaluate(()=>{window.scrollTo(0,document.body.scrollHeight);for(const el of document.querySelectorAll('*'))if(el.scrollHeight>el.clientHeight)el.scrollTop=el.scrollHeight})
 const action=await reset.boundingBox(),nav=await page.getByRole('navigation',{name:'Primary'}).boundingBox();expect(action!.y+action!.height).toBeLessThanOrEqual(nav!.y)
})
