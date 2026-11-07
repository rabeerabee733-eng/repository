import http from 'node:http';
import {timingSafeEqual,randomUUID,createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserDriver} from './driver.mjs';
import {verifiedWorkflows,setupMessage} from './workflows.mjs';

const terminal=new Set(['completed','failed','cancelled','needs_setup']);
const ID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
function error(code,status=400){return Object.assign(new Error(code),{status});}
function authorize(value,secret){const a=Buffer.from(value||''),b=Buffer.from('Bearer '+secret);return a.length===b.length&&timingSafeEqual(a,b);}
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function read(req,limit=128*1024){const chunks=[];let n=0;for await(const b of req){n+=b.length;if(n>limit)throw error('BODY_TOO_LARGE',413);chunks.push(b)}return Buffer.concat(chunks);}
const publicJob=j=>({id:j.id,jobId:j.jobId,mode:j.mode,state:j.state,message:j.message,otpExpires:j.otpExpires,results:j.results,version:j.version,mayHaveWritten:j.mayHaveWritten,requiresReview:j.mayHaveWritten&&['failed','cancelled'].includes(j.state),updatedAt:j.updatedAt});
export function createRunner({secret=process.env.RUNNER_API_KEY,driver=browserDriver,workflows=verifiedWorkflows,clock=()=>Date.now()}={}) {
  if(!secret||secret.length<48)throw new Error('RUNNER_API_KEY must be configured');
  const jobs=new Map();
  const kinds=Object.entries(workflows).filter(([,w])=>w.verified&&w.version).map(([kind])=>kind);
  const cleanup=async j=>{j.credentials=null;j.submitOtp=null;await j.close?.().catch(()=>{});if(j.dir)await rm(j.dir,{recursive:true,force:true}).catch(()=>{});j.files.clear();};
  const update=(j,state,message)=>{if(terminal.has(j.state))return;j.state=state;j.message=message;j.updatedAt=new Date(clock()).toISOString();j.version++;if(terminal.has(state)){j.otpExpires=null;void cleanup(j)}};
  const fail=j=>update(j,'failed',j.mayHaveWritten?'انقطعت الجلسة بعد بدء الرفع. راجع أجيال قبل إعادة إرسال أي ملف لتجنب التكرار.':'تعذر إكمال الدخول. تحقق من بيانات الحساب أو توفر أجيال ثم ابدأ جلسة جديدة.');
  const expire=j=>{if(!terminal.has(j.state)&&(clock()>=j.expires||(j.state==='waiting_otp'&&clock()>=j.otpExpires)))update(j,'failed',j.mayHaveWritten?'انتهت مهلة الجلسة بعد بدء الرفع. راجع أجيال قبل أي إعادة محاولة لتجنب التكرار.':'انتهت مهلة الجلسة أو رمز التحقق. ابدأ جلسة دخول جديدة.');};
  const active=j=>{expire(j);if(terminal.has(j.state))throw error('SESSION_CLOSED',409);};
  const timer=setInterval(()=>{for(const [id,j] of jobs){expire(j);if(terminal.has(j.state)&&clock()>j.expires+3600000)jobs.delete(id)}},5000);timer.unref();
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/health')return reply(res,200,{ok:true,service:'ajyal-upload-runner',version:'0.2.1'});
      if(!authorize(req.headers.authorization,secret))return reply(res,401,{error:'UNAUTHORIZED'});
      if(req.method==='GET'&&url.pathname==='/v1/capabilities')return reply(res,200,{login:true,uploadKinds:kinds,setupMessage,concurrency:1,sessionMinutes:15});
      const parts=url.pathname.split('/').filter(Boolean);
      if(parts[0]!=='v1'||parts[1]!=='sessions')throw error('NOT_FOUND',404);
      const id=parts[2];
      if(!ID.test(id||''))throw error('INVALID_ID');
      if(req.method==='PUT'&&parts.length===3){
        if(jobs.has(id))return reply(res,200,publicJob(jobs.get(id)));
        if([...jobs.values()].some(j=>!terminal.has(j.state)))throw error('RUNNER_BUSY',409);
        if(jobs.size>=100)throw error('CAPACITY',429);
        const b=JSON.parse((await read(req)).toString());
        const m=b.manifest;
        if(!ID.test(b.jobId||'')||!m||![1,2,3].includes(m.grade)||!m.section||!['1','2'].includes(m.term)||!/^20\d{2}\/20\d{2}$/.test(m.year)||!m.account?.username||!Array.isArray(m.items)||!m.items.length||m.items.length>60)throw error('INVALID_MANIFEST');
        if(!['login_check','upload'].includes(b.mode))throw error('INVALID_MODE');
        if(b.mode==='upload'&&m.items.some(i=>!kinds.includes(i.kind)))throw error('WORKFLOW_NOT_VERIFIED',409);
        if(m.items.some(i=>!ID.test(i.id)||!i.filename||!i.subject||!Number.isInteger(i.size)||i.size<=0||i.size>25*1024*1024||!/^[a-f\d]{64}$/i.test(i.digest)))throw error('INVALID_ITEMS');
        if(new Set(m.items.map(i=>i.id)).size!==m.items.length)throw error('DUPLICATE_ITEMS');
        // Reading a request body yields to other requests. Re-check atomically
        // after it finishes so concurrent creates cannot overwrite a session or
        // admit two browsers into a single-session runner.
        if(jobs.has(id))return reply(res,200,publicJob(jobs.get(id)));
        if([...jobs.values()].some(j=>!terminal.has(j.state)))throw error('RUNNER_BUSY',409);
        if(jobs.size>=100)throw error('CAPACITY',429);
        const j={id,jobId:b.jobId,mode:b.mode,manifest:m,state:'staging',message:'الجلسة جاهزة لبدء الدخول.',results:[],version:1,updatedAt:new Date(clock()).toISOString(),expires:clock()+900000,otpExpires:null,files:new Map(),credentials:null,mayHaveWritten:false};jobs.set(id,j);
        return reply(res,201,publicJob(j));
      }
      const j=jobs.get(id);if(!j)throw error('SESSION_LOST',404);expire(j);
      if(req.method==='GET'&&parts.length===3)return reply(res,200,publicJob(j));
      if(req.method==='DELETE'&&parts.length===3){update(j,'cancelled','أُوقفت الجلسة. لا تُحذف الملفات التي سبق حفظها داخل أجيال.');await cleanup(j);return reply(res,200,publicJob(j))}
      if(terminal.has(j.state))throw error('SESSION_CLOSED',409);
      if(req.method==='PUT'&&parts[3]==='files'){
        if(j.state!=='staging'||j.mode!=='upload')throw error('INVALID_STATE',409);
        const item=j.manifest.items.find(i=>i.id===parts[4]);if(!item)throw error('UNKNOWN_ITEM',404);
        const bytes=await read(req,25*1024*1024);
        if(bytes.length!==item.size||createHash('sha256').update(bytes).digest('hex')!==item.digest)throw error('FILE_MISMATCH');
        if(!j.dir)j.dir=await mkdtemp(path.join(tmpdir(),'ajyal-'));
        const filename=path.join(j.dir,item.id);await writeFile(filename,bytes,{mode:0o600});j.files.set(item.id,filename);return reply(res,200,{ok:true});
      }
      if(req.method==='POST'&&parts[3]==='login'){
        if(j.state!=='staging')return reply(res,200,publicJob(j)); // no second login/OTP on network retries
        const b=JSON.parse((await read(req,4096)).toString());
        // A retry/cancellation/timeout can arrive while this body is streaming.
        active(j);
        if(j.state!=='staging')return reply(res,200,publicJob(j));
        if(b.username!==j.manifest.account.username||typeof b.password!=='string'||!b.password||b.password.length>500)throw error('INVALID_CREDENTIALS');
        if(j.mode==='upload'&&j.files.size!==j.manifest.items.length)throw error('FILES_NOT_READY');
        j.credentials={username:b.username,password:b.password};b.password='';
        update(j,'connecting','جارٍ الاتصال بأجيال.');
        Promise.resolve().then(()=>driver(j,(s,m)=>update(j,s,m),()=>terminal.has(j.state))).catch(()=>fail(j));
        return reply(res,202,publicJob(j));
      }
      if(req.method==='POST'&&parts[3]==='otp'){
        if(j.state!=='waiting_otp'||!j.submitOtp||j.otpExpires<=clock())throw error('OTP_NOT_REQUESTED',409);
        const b=JSON.parse((await read(req,1024)).toString());if(!/^\d{6}$/.test(b.code))throw error('INVALID_OTP');
        active(j);
        if(j.state!=='waiting_otp'||!j.submitOtp||j.otpExpires<=clock())throw error('OTP_NOT_REQUESTED',409);
        const submit=j.submitOtp;update(j,'checking_otp','جارٍ تدقيق الرمز.');
        Promise.resolve().then(async()=>{try{await submit(b.code)}finally{b.code=''}}).catch(()=>fail(j));
        return reply(res,202,publicJob(j));
      }
      throw error('NOT_FOUND',404);
    } catch(e) { reply(res,e.status||400,{error:e.status?e.message:'REQUEST_FAILED'}); }
  });
  const close=async()=>{clearInterval(timer);for(const j of jobs.values())await cleanup(j);await new Promise(resolve=>server.close(resolve));};
  return {server,close,jobs};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const runner=createRunner();runner.server.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('Ajyal runner listening'));
  if(process.env.AJYAL_CONNECTIVITY_PROBE==='true')void import('./connectivity-probe.mjs').then(m=>m.runConnectivityProbe()).catch(()=>console.log(JSON.stringify({event:'ajyal_connectivity',error:'PROBE_FAILED'})));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>runner.close().finally(()=>process.exit(0)));
}

