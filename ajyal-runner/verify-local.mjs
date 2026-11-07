import {chromium} from 'playwright';import {createHash} from 'node:crypto';import {createInterface} from 'node:readline';
import {officialUrl} from './engine.mjs';import {LOGIN} from './workflows.mjs';
const browser=await chromium.launch({channel:'chrome',headless:false});
const context=await browser.newContext({locale:'ar-JO',acceptDownloads:false});
await context.route('**/*',r=>officialUrl(r.request().url())?r.continue():r.abort());
const page=await context.newPage();page.setDefaultTimeout(15000);
const output=value=>console.log(JSON.stringify(value));let active=false,done=false;
const expiry=setTimeout(()=>void browser.close(),30*60000);
browser.on('disconnected',()=>{clearTimeout(expiry);process.exit(0);});
async function status(){output({stage:'STATUS',path:new URL(page.url()).pathname,login:await page.locator(LOGIN.username).isVisible().catch(()=>false),otp:await page.locator(LOGIN.otp).isVisible().catch(()=>false)});}
async function report(){
 if(active||done)return;active=true;
 try{
  const {readRoster}=await import('./roster-reader.mjs?revision='+Date.now());
  const roster=await readRoster(page);
  output({stage:'AUTOMATIC_ROSTER_VERIFIED',teacherName:roster.teacherName,school:roster.school,grade:roster.grade,section:roster.section,totalCount:roster.totalCount,rosterSha256:createHash('sha256').update(JSON.stringify(roster.names)).digest('hex')});done=true;
 }catch(error){output({stage:'VERIFICATION_FAILED',error:error.code||error.name,path:new URL(page.url()).pathname});}
 finally{active=false;}
}
const input=createInterface({input:process.stdin,crlfDelay:Infinity});let chain=Promise.resolve();
input.on('line',line=>{chain=chain.then(async()=>{
 const cmd=line.trim();
 if(cmd==='status')await status();
 else if(cmd==='report')await report();
 else if(cmd==='navigation'){
  if(!officialUrl(page.url()))return;
  const navigation=await page.locator('a').evaluateAll(links=>links.filter(a=>['التقارير','تقارير الطلبة','كشف بأسماء الطلبة'].includes(a.innerText.trim())).map(a=>({label:a.innerText.trim(),path:a.protocol==='https:'?new URL(a.href).pathname:null,id:a.id})));
  output({stage:'NAVIGATION',navigation});
 }else if(cmd==='open-reports')await page.getByRole('link',{name:'التقارير',exact:true}).click();
 else if(cmd==='close')await browser.close();
}).catch(()=>output({stage:'ACTION_FAILED'}));});
try{
 await page.goto(LOGIN.url,{waitUntil:'domcontentloaded',timeout:45000});
 output({stage:'WAITING_MANUAL_LOGIN'});
 await page.waitForURL(url=>url.pathname.endsWith('/HomePage.aspx'),{timeout:20*60000});
 await page.waitForLoadState('load');await status();await report();
}catch(error){output({stage:'VERIFICATION_FAILED',error:error.code||error.name,path:new URL(page.url()).pathname});}
