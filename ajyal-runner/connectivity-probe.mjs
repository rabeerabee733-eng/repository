import https from 'node:https';
import {LOGIN} from './workflows.mjs';
import {officialUrl} from './engine.mjs';

// A fixed, unauthenticated diagnostic. Never submit forms, read page bodies,
// retain cookies, or emit browser errors that may contain private page content.
export async function probeBrowser(chromium){
  let browser;const start=Date.now();
  try{
    browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
    const context=await browser.newContext({locale:'ar-JO',acceptDownloads:false,serviceWorkers:'block'});
    await context.route('**/*',r=>officialUrl(r.request().url())?r.continue():r.abort());
    const page=await context.newPage();
    const response=await page.goto(LOGIN.url,{waitUntil:'domcontentloaded',timeout:45000});
    const allowed=officialUrl(page.url());
    const loginForm=allowed&&await page.locator(LOGIN.username).isVisible()&&await page.locator(LOGIN.password).isVisible();
    return {stage:'browser',status:response?.status()||null,official:allowed,loginForm,elapsedMs:Date.now()-start};
  }catch(error){return {stage:'browser',error:error.name==='TimeoutError'?'TIMEOUT':String(error.message||'').match(/net::(ERR_[A-Z_]+)/)?.[1]||'BROWSER_ERROR',elapsedMs:Date.now()-start};}
  finally{await browser?.close().catch(()=>{});}
}
export function probeHttps(){return new Promise(resolve=>{
  const start=Date.now();let settled=false;
  const finish=result=>{if(settled)return;settled=true;clearTimeout(deadline);resolve({stage:'https',...result,elapsedMs:Date.now()-start});};
  const req=https.get(LOGIN.url,{timeout:15000},res=>{finish({status:res.statusCode});res.destroy();});
  const deadline=setTimeout(()=>req.destroy(Object.assign(Error('TIMEOUT'),{code:'TIMEOUT'})),15000);
  req.on('timeout',()=>req.destroy(Object.assign(Error('TIMEOUT'),{code:'TIMEOUT'})));
  req.on('error',e=>finish({error:/^[A-Z_]{1,60}$/.test(e.code||'')?e.code:'NETWORK_ERROR'}));
});}
export async function runConnectivityProbe(){
  const {chromium}=await import('playwright');
  const results=await Promise.all([probeHttps(),probeBrowser(chromium)]);
  for(const result of results)console.log(JSON.stringify({event:'ajyal_connectivity',at:new Date().toISOString(),...result}));
  return results;
}
