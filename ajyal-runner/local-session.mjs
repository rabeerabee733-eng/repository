// Supervised local acceptance session. It does not upload or submit any form.
import {chromium} from 'playwright';
import {createInterface} from 'node:readline';
import {officialUrl} from './engine.mjs';
import {LOGIN} from './workflows.mjs';

const output = value => process.stdout.write(JSON.stringify(value)+'\n');
const browser = await chromium.launch({channel:'chrome',headless:false});
const context = await browser.newContext({locale:'ar-JO',acceptDownloads:false});
await context.route('**/*', route => officialUrl(route.request().url()) ? route.continue() : route.abort());
const page = await context.newPage();
page.setDefaultTimeout(12000);
let closed=false, timer;
async function close() {
  if(closed)return; closed=true;clearTimeout(timer);
  await browser.close();process.exit(0);
}
function touch(){clearTimeout(timer);timer=setTimeout(close,30*60*1000);}
const visible = selector => page.locator(selector).isVisible().catch(()=>false);
function safeUrl(value){try{const u=new URL(value);return u.origin+u.pathname;}catch{return '';}}
async function status() {
  const official=officialUrl(page.url());
  const username=official&&await visible(LOGIN.username);
  const otp=official&&await visible(LOGIN.otp);
  output({type:'status',url:safeUrl(page.url()),official,loginForm:username,otpForm:otp,
    stage:otp?'waiting_otp':username?'waiting_manual_login':official?'needs_page_verification':'navigation_failed',
    automaticUploads:false,automaticRosterExtraction:false});
}
async function inspect(){
  if(!officialUrl(page.url()))return output({error:'OFFICIAL_ORIGIN_REQUIRED'});
  // Never serialize input values, hidden fields, cookies, URLs with tokens, or HTML.
  const snapshot=await page.evaluate(()=>{
    const visible=e=>!!(e.getBoundingClientRect().width&&e.getBoundingClientRect().height);
    const text=e=>(e.innerText||e.textContent||'').trim().slice(0,500);
    const path=value=>{try{const u=new URL(value,location.href);return u.origin+u.pathname;}catch{return '';}};
    return {title:document.title,text:document.body.innerText.slice(0,16000),
      controls:[...document.querySelectorAll('input,button,select,a')].filter(visible).slice(0,200).map(e=>({
        tag:e.tagName,type:e.type||'',id:e.id||'',name:e.name||'',label:e.tagName==='INPUT'?(e.getAttribute('aria-label')||e.placeholder||''):text(e),
        href:e.tagName==='A'?path(e.href):undefined,
        options:e.tagName==='SELECT'?[...e.options].map(o=>({value:o.value,label:o.text})):undefined
      }))};
  });
  output({type:'inspection',...snapshot});
}
const input=createInterface({input:process.stdin,crlfDelay:Infinity});
let chain=Promise.resolve();
input.on('line',line=>{chain=chain.then(async()=>{
  touch();const command=line.trim();
  if(command==='status')await status();
  else if(command==='inspect')await inspect();
  else if(command==='close')await close();
  else output({error:'Use status, inspect, or close. Enter credentials only in the visible official page.'});
}).catch(()=>output({error:'INSPECTION_FAILED'}));});
process.on('SIGINT',close);process.on('SIGTERM',close);
browser.on('disconnected',()=>process.exit(0));
touch();
try {
  const response=await page.goto(LOGIN.url,{waitUntil:'domcontentloaded',timeout:45000});
  output({type:'connection',httpStatus:response?.status()||null});
  await status();
} catch(error){output({type:'connection',error:error.name==='TimeoutError'?'CONNECTION_TIMEOUT':'CONNECTION_FAILED'});}
output({type:'ready',commands:['status','inspect','close'],idleMinutes:30});
