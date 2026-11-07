import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';import {officialUrl} from './engine.mjs';import {LOGIN} from './workflows.mjs';import {readRoster,REPORT_FIELDS} from './roster-reader.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));const fail=code=>{throw Object.assign(Error(code),{code});};
const config=JSON.parse(await fs.readFile(new URL('./worker-config.json',import.meta.url),'utf8'));
if(config.server!=='https://altahdir-ai-agent.onrender.com')throw Error('INVALID_SERVER');
const protectedToken=await fs.readFile(new URL('./worker-token.dpapi',import.meta.url),'utf8');
// Protected with the current Windows user's DPAPI key; never emit this value.
const token=execFileSync('powershell.exe',['-NoProfile','-Command','Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'],{input:protectedToken,encoding:'utf8',windowsHide:true}).trim();
if(token.length<48)throw Error('WORKER_NOT_PAIRED');
const lockPath=new URL('./worker.lock',import.meta.url);let lock;
try{lock=await fs.open(lockPath,'wx');}catch{
 const pid=Number(await fs.readFile(lockPath,'utf8'));try{process.kill(pid,0);process.exit(0);}catch(error){if(error.code!=='ESRCH')throw Error('WORKER_LOCKED');}
 await fs.unlink(lockPath);lock=await fs.open(lockPath,'wx');
}
await lock.writeFile(String(process.pid));await lock.close();
let lastStatus='';const log=code=>{if(code===lastStatus)return;lastStatus=code;console.log(JSON.stringify({at:new Date().toISOString(),status:code}));};
async function api(route,body={}){const r=await fetch(config.server+'/internal/ajyal-worker/'+route,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});let data;try{data=await r.json();}catch{fail('SERVER_UNAVAILABLE');}if(!r.ok)fail(/^[A-Z_]{1,60}$/.test(data.error||'')?data.error:'SERVER_UNAVAILABLE');return data;}
let closing=false,browser;
async function stop(){if(closing)return;closing=true;await browser?.close().catch(()=>{});await fs.unlink(lockPath).catch(()=>{});process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
const visible=(page,s)=>page.locator(s).isVisible().catch(()=>false);
async function run(job){
 const lease={id:job.id,lease:job.lease};let invalid=false,health;
 try{
 browser=await chromium.launch({channel:'chrome',headless:false});
 const context=await browser.newContext({locale:'ar-JO',acceptDownloads:false});
 await context.route('**/*',r=>officialUrl(r.request().url())?r.continue():r.abort());
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const activeBrowser=browser;
 health=setInterval(()=>{api('progress',lease).catch(()=>{invalid=true;void activeBrowser.close().catch(()=>{});});},10000);
  await page.goto(LOGIN.url,{waitUntil:'domcontentloaded',timeout:45000});
  if(page.url()!==LOGIN.url)fail('LOGIN_FAILED');
  await page.locator(LOGIN.username).fill(job.username);await page.locator(LOGIN.password).fill(job.password);job.password='';
  await api('progress',lease);await page.locator(LOGIN.submit).click();
  let loggedIn=false;const deadline=Date.now()+45000;
  while(Date.now()<deadline&&!invalid){
   if(!officialUrl(page.url()))fail('LOGIN_FAILED');
   if(await visible(page,LOGIN.otp)){
    await api('otp-requested',lease);log('WAITING_TEACHER_OTP');let code=null;const end=Date.now()+285000;
    while(Date.now()<end&&!invalid){const result=await api('otp',lease);if(result.code){code=result.code;break;}await delay(2000);}
    if(!code)fail('OTP_TIMEOUT');
    await page.locator(LOGIN.otp).fill(code);code=null;await page.locator(LOGIN.otpSubmit).click();
    await page.locator(REPORT_FIELDS.identity).waitFor({state:'visible',timeout:30000});loggedIn=true;break;
   }
   if(await visible(page,REPORT_FIELDS.identity)&&!await visible(page,LOGIN.username)){loggedIn=true;break;}
   const body=await page.locator('body').innerText();if(/verify you are human|captcha|تحقق من أنك إنسان/i.test(body))fail('CAPTCHA_REQUIRED');
   await delay(300);
  }
  if(!loggedIn||invalid)fail('LOGIN_FAILED');await api('progress',lease);
  const roster=await readRoster(page,job.expected,()=>invalid||closing);
  await api('progress',lease);
  // Repeating completion is safe if its acknowledgement was lost.
  try{await api('complete',{...lease,roster});}catch(error){if(error.code)throw error;await api('complete',{...lease,roster});}
  log('ROSTER_ACCEPTED');
 }catch(error){await api('failed',{...lease,code:error.code||'WORKER_FAILED'}).catch(()=>{});log(/^[A-Z_]{1,60}$/.test(error.code||'')?error.code:'WORKER_FAILED');}
 finally{job.password='';clearInterval(health);await browser?.close().catch(()=>{});browser=null;}
}
log('WORKER_STARTED');
while(!closing){try{const {job}=await api('claim');if(job)await run(job);}catch(error){log(error.code==='WORKER_DISABLED'?'AWAITING_ACTIVATION':'SERVER_UNAVAILABLE');}await delay(15000);}
