// Runs only against the disposable review worker with synthetic administrator state.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR ?? '/source/review-evidence';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({ignoreHTTPSErrors:true,locale:'en',viewport:{width:1280,height:800},baseURL:process.env.BASE_URL});
await context.tracing.start({screenshots:true,snapshots:true});
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
let original,token,failure;
const api='/api/OpenELIS-Global/api/labelPresets';
async function presets(){const response=await page.request.get(api);expect(response.status()).toBe(200);return response.json();}
try {
 await page.goto('/login');await page.locator('#loginName').fill('admin');await page.locator('#password').fill('adminADMIN!');await page.locator('[data-cy="loginButton"]').click();
 await expect(page.getByRole('navigation',{name:'Side navigation'})).toBeVisible({timeout:60000});
 token=await page.evaluate(()=>localStorage.getItem('CSRF'));
 await page.goto('/MasterListsPage/labelPresets');
 original=(await presets()).find(p=>p.name==='Order Label');expect(original).toBeTruthy();
 const row=page.locator('tr',{hasText:'Order Label'}).first();await expect(row).toBeVisible();
 await row.getByRole('button',{name:'Options'}).click();await page.getByRole('menuitem',{name:'Edit'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Edit Label Preset'})).toBeVisible();
 await expect(dialog.locator('#preset-name')).toBeDisabled();
 await page.screenshot({path:out+'/label-before.png'});
 await dialog.getByRole('button',{name:'Increment number'}).first().click();
 await expect(dialog.locator('#preset-heightMm')).toHaveValue(String(original.heightMm+1));
 const saved=page.waitForResponse(r=>r.request().method()==='PUT' && /\/api\/labelPresets\/\d+$/.test(r.url()));
 await dialog.getByRole('button',{name:'Save',exact:true}).click();expect((await saved).ok()).toBeTruthy();
 await expect(page.locator('.cds--toast-notification--success')).toBeVisible();await expect(dialog).toBeHidden();
 const after=(await presets()).find(p=>p.id===original.id);
 expect(after.heightMm).toBe(original.heightMm+1);expect(after.widthMm).toBe(original.widthMm);expect(after.name).toBe(original.name);
 expect(after.fields.map(f=>f.fieldKey)).toEqual(original.fields.map(f=>f.fieldKey));
 await page.screenshot({path:out+'/label-after.png'});
 await writeFile(out+'/label-readback.json',JSON.stringify({before:{name:original.name,heightMm:original.heightMm,widthMm:original.widthMm},after:{name:after.name,heightMm:after.heightMm,widthMm:after.widthMm},fieldsPreserved:true},null,2));
} catch(error) {failure=error;await page.screenshot({path:out+'/label-failure.png'}).catch(()=>{});}
finally {
 if(original) {
  const response=await page.request.put(api+'/'+original.id,{headers:{'X-CSRF-Token':token,'Content-Type':'application/json'},data:{...original}});
  if(!response.ok() && !failure)failure=Error('Fixture restoration failed: '+response.status());
 }
 await writeFile(out+'/browser-errors.json',JSON.stringify(errors,null,2));
 await context.tracing.stop({path:out+'/label-trace.zip'});
 await context.close();await browser.close();
 const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const failureTag=failure?.matcherResult || failure?.name==='AssertionError' ? 'failure':'error';
 await writeFile(out+'/label-workflow.xml','<testsuite><testcase name="label preset edit saves and reads back">'+(failure?'<'+failureTag+' message="'+escape(failure.message)+'"/>':'')+'</testcase></testsuite>');
}
if(failure){console.error(failure.message);process.exitCode=1;}
