import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import http from 'node:http';
import {createRunner} from './server.mjs';
import {officialUrl,loginUrl,uploadItems} from './engine.mjs';

test('isolated login protocol, credentials, OTP and upload gate',async()=>{
 const secret='synthetic-test-key-'.repeat(4);let calls=0;
 const runner=createRunner({secret,driver:async(j,update)=>{
  calls++;assert.equal(j.credentials.password,'test-only');j.credentials=null;
  j.otpExpires=Date.now()+200000;j.submitOtp=async code=>{assert.equal(code,'123456');update('needs_setup','No files uploaded.');};
  update('waiting_otp','Waiting for code.');
 }});
 await new Promise(resolve=>runner.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+runner.server.address().port;
 async function call(p,m='GET',b,auth=true){const r=await fetch(base+p,{method:m,headers:{...(auth?{Authorization:'Bearer '+secret}:{}),'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});return {status:r.status,data:await r.json()};}
 try{
  assert.equal((await call('/health','GET',null,false)).status,200);
  assert.equal((await call('/v1/capabilities','GET',null,false)).status,401);
  const id=randomUUID(),jobId=randomUUID();
  const manifest={account:{username:'test-user'},grade:1,section:'أ',year:'2026/2027',term:'1',items:[{id:randomUUID(),filename:'test.pdf',subject:'الرياضيات',kind:'plan',size:3,digest:createHash('sha256').update('pdf').digest('hex')}]};
  assert.equal((await call('/v1/sessions/'+id,'PUT',{jobId,mode:'upload',manifest})).data.error,'WORKFLOW_NOT_VERIFIED');
  assert.equal((await call('/v1/sessions/'+id,'PUT',{jobId,mode:'login_check',manifest})).status,201);
  assert.equal((await call('/v1/sessions/'+id+'/otp','POST',{code:'123456'})).status,409);
  assert.equal((await call('/v1/sessions/'+randomUUID(),'PUT',{jobId:randomUUID(),mode:'login_check',manifest})).data.error,'RUNNER_BUSY');
  await call('/v1/sessions/'+id+'/login','POST',{username:'test-user',password:'test-only'});
  await call('/v1/sessions/'+id+'/login','POST',{username:'test-user',password:'test-only'});
  assert.equal(calls,1,'network retries do not resend login');
  let state=(await call('/v1/sessions/'+id)).data;
  assert.equal(state.state,'waiting_otp');assert(!JSON.stringify(state).includes('test-only'));assert(!JSON.stringify(state).includes('test-user'));
  assert.equal((await call('/v1/sessions/'+id+'/otp','POST',{code:'12'})).data.error,'INVALID_OTP');
  await call('/v1/sessions/'+id+'/otp','POST',{code:'123456'});
  assert.equal((await call('/v1/sessions/'+id+'/otp','POST',{code:'123456'})).status,409);
  state=(await call('/v1/sessions/'+id)).data;
  assert.equal(state.state,'needs_setup');assert.equal(state.results.length,0);assert(!JSON.stringify(state).includes('123456'));
  assert.equal((await call('/v1/sessions/'+randomUUID())).data.error,'SESSION_LOST');
 }finally{await runner.close();}
});

test('course resources may use the exact LMS origin; credentials stay on the login origin',()=>{
 assert(officialUrl('https://ajyallms.moe.gov.jo/EduWaveSIS/TeacherCourseView_New.aspx'));
 assert(loginUrl('https://ajyal.moe.gov.jo/emis/login.aspx'));
 assert(!loginUrl('https://ajyallms.moe.gov.jo/'));
 for(const url of ['http://ajyallms.moe.gov.jo/','https://ajyallms.moe.gov.jo.evil.test/','https://evil.ajyallms.moe.gov.jo/','https://user:pass@ajyallms.moe.gov.jo/','https://ajyallms.moe.gov.jo:444/']){
  assert(!officialUrl(url));assert(!loginUrl(url));
 }
});

async function protocol(t,driver){
 let now=Date.now();const secret='synthetic-concurrency-key-'.repeat(3);
 const runner=createRunner({secret,driver,clock:()=>now});
 await new Promise(resolve=>runner.server.listen(0,'127.0.0.1',resolve));
 t.after(()=>runner.close());
 const base='http://127.0.0.1:'+runner.server.address().port;
 const headers={Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 const call=async(p,m='GET',body)=>{const r=await fetch(base+p,{method:m,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 // Start a real HTTP request, but hold its body after the server accepts its
 // headers. This deterministically exercises the race at await read(req).
 const held=async(p,m)=>{
  let req;const accepted=new Promise(resolve=>runner.server.once('request',resolve));
  const response=new Promise((resolve,reject)=>{req=http.request(base+p,{method:m,headers:{...headers,'Transfer-Encoding':'chunked'}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks))}));});req.on('error',reject);req.flushHeaders();});
  await accepted;
  return {finish:body=>{req.end(JSON.stringify(body));return response;}};
 };
 const body=()=>({jobId:randomUUID(),mode:'login_check',manifest:{account:{username:'synthetic-user'},grade:1,section:'ب',term:'1',year:'2026/2027',items:[{id:randomUUID(),kind:'plan',subject:'الرياضيات',filename:'synthetic.pdf',size:3,digest:createHash('sha256').update('pdf').digest('hex')}]}});
 const create=async()=>{const p='/v1/sessions/'+randomUUID();assert.equal((await call(p,'PUT',body())).status,201);return p;};
 return {runner,call,held,body,create,advance:ms=>now+=ms};
}

test('concurrent session creation never admits two active sessions',async t=>{
 const p=await protocol(t,async()=>{});
 const slow=await p.held('/v1/sessions/'+randomUUID(),'PUT');
 await p.create();
 assert.equal((await slow.finish(p.body())).data.error,'RUNNER_BUSY');
 assert.equal(p.runner.jobs.size,1);
});

test('concurrent creation with one ID does not overwrite the established session',async t=>{
 const p=await protocol(t,async()=>{}),path='/v1/sessions/'+randomUUID(),body=p.body();
 const slow=await p.held(path,'PUT');
 assert.equal((await p.call(path,'PUT',body)).status,201);
 const original=p.runner.jobs.get(path.split('/').at(-1));
 assert.equal((await slow.finish(body)).status,200);
 assert.equal(p.runner.jobs.get(original.id),original);
});

test('concurrent login retries submit the password only once',async t=>{
 let calls=0;const p=await protocol(t,async(j,update)=>{calls++;j.credentials=null;update('verifying','Synthetic only.');});
 const path=await p.create(),slow=await p.held(path+'/login','POST'),credentials={username:'synthetic-user',password:'synthetic-only'};
 await p.call(path+'/login','POST',credentials);
 assert.equal((await slow.finish(credentials)).status,200);
 assert.equal(calls,1);
});

test('a login body arriving after cancellation cannot start a browser',async t=>{
 let calls=0;const p=await protocol(t,async()=>{calls++;}),path=await p.create();
 const slow=await p.held(path+'/login','POST');
 await p.call(path,'DELETE');
 assert.equal((await slow.finish({username:'synthetic-user',password:'synthetic-only'})).data.error,'SESSION_CLOSED');
 assert.equal(calls,0);
 assert.equal((await p.call(path)).data.state,'cancelled');
});

test('a login body arriving at the expiry deadline cannot start a browser',async t=>{
 let calls=0;const p=await protocol(t,async()=>{calls++;}),path=await p.create();
 const slow=await p.held(path+'/login','POST');p.advance(900000);
 assert.equal((await slow.finish({username:'synthetic-user',password:'synthetic-only'})).data.error,'SESSION_CLOSED');
 assert.equal(calls,0);
});

test('concurrent OTP submissions consume only one code',async t=>{
 let calls=0;const p=await protocol(t,async(j,update)=>{j.credentials=null;j.otpExpires=Date.now()+100000;j.submitOtp=async()=>{calls++;update('verifying','Synthetic only.');};update('waiting_otp','Synthetic only.');});
 const path=await p.create();await p.call(path+'/login','POST',{username:'synthetic-user',password:'synthetic-only'});
 const slow=await p.held(path+'/otp','POST');
 await p.call(path+'/otp','POST',{code:'123456'});
 assert.equal((await slow.finish({code:'123456'})).data.error,'OTP_NOT_REQUESTED');assert.equal(calls,1);
});

test('an OTP expiring while its body arrives is never submitted',async t=>{
 let calls=0;const p=await protocol(t,async(j,update)=>{j.credentials=null;j.otpExpires=Date.now()+100000;j.submitOtp=async()=>{calls++;};update('waiting_otp','Synthetic only.');});
 const path=await p.create();await p.call(path+'/login','POST',{username:'synthetic-user',password:'synthetic-only'});
 const slow=await p.held(path+'/otp','POST');p.advance(200000);
 assert.equal((await slow.finish({code:'123456'})).data.error,'SESSION_CLOSED');assert.equal(calls,0);
});

test('expiry after a possible write explicitly requires manual reconciliation',async t=>{
 const p=await protocol(t,async(j,update)=>{j.credentials=null;j.mayHaveWritten=true;update('uploading','Synthetic only.');});
 const path=await p.create();await p.call(path+'/login','POST',{username:'synthetic-user',password:'synthetic-only'});
 p.advance(900000);const result=(await p.call(path)).data;
 assert.equal(result.state,'failed');assert.equal(result.requiresReview,true);assert.match(result.message,/قبل أي إعادة محاولة/);assert.equal(result.results.length,0);
});

for(const stopAt of ['destination','evidence'])test('cancellation during '+stopAt+' does not record completion or start a later write',async()=>{
 let stopped=false,writes=0,checks=0;
 const item={id:'synthetic',subject:'الرياضيات',kind:'plan',filename:'synthetic.pdf'};
 const target={account:{username:'synthetic-user'},grade:1,section:'ب',year:'2026/2027',term:'1',items:[item]};
 const dest={grade:1,section:'ب',year:'2026/2027',term:'1',subject:item.subject,kind:item.kind};
 const job={manifest:target,files:new Map(),results:[]};
 const adapter={verified:true,version:'synthetic',verifyAccount:async()=>target.account,selectDestination:async()=>{},verifyDestination:async()=>{if(++checks===2&&stopAt==='destination')stopped=true;return dest;},findExisting:async()=>false,uploadAndSave:async()=>{writes++;},verifySavedAfterReload:async()=>{if(stopAt==='evidence')stopped=true;return {...dest,saved:true,filename:item.filename,recordId:'synthetic',verifiedAt:new Date().toISOString(),url:'https://ajyallms.moe.gov.jo/EduWaveSIS/TeacherCourseView_New.aspx'};}};
 await uploadItems({page:{url:()=> 'https://ajyallms.moe.gov.jo/EduWaveSIS/TeacherCourseView_New.aspx'},job,workflows:{plan:adapter},update:()=>{},isStopped:()=>stopped});
 assert.equal(writes,stopAt==='destination'?0:1);assert.equal(job.results.length,0);
});

test('destination, account and proof must match before completion',async()=>{
 assert(officialUrl('https://ajyal.moe.gov.jo/emis/plans.aspx'));
 for(const u of ['https://ajyal.moe.gov.jo.evil.test/','http://ajyal.moe.gov.jo/','https://user@ajyal.moe.gov.jo/'])assert(!officialUrl(u));
 const item={id:'item',filename:'sample.pdf',subject:'الرياضيات',kind:'plan'};
 const target={account:{username:'test-user',school:'Test school'},grade:1,section:'ب',term:'1',year:'2026/2027',items:[item]};
 const dest={grade:1,section:'ب',term:'1',year:'2026/2027',subject:item.subject,kind:'plan'};
 let writes=0;const adapter={verified:true,version:'synthetic-test',verifyAccount:async()=>target.account,selectDestination:async()=>{},verifyDestination:async()=>dest,findExisting:async()=>false,uploadAndSave:async()=>{writes++},verifySavedAfterReload:async()=>({...dest,filename:item.filename,saved:true,recordId:'record',verifiedAt:new Date().toISOString(),url:'https://ajyal.moe.gov.jo/test'})};
 const run=async changes=>{const job={manifest:target,files:new Map([['item','/synthetic/file']]),results:[]};await uploadItems({page:{url:()=> 'https://ajyal.moe.gov.jo/test'},job,workflows:{plan:{...adapter,...changes}},update:()=>{},isStopped:()=>false});return job;};
 await assert.rejects(()=>run({verifyAccount:async()=>({username:'wrong'})}),/ACCOUNT_MISMATCH/);assert.equal(writes,0);
 await assert.rejects(()=>run({verifyDestination:async()=>({...dest,section:'أ'})}),/DESTINATION_MISMATCH/);assert.equal(writes,0);
 await assert.rejects(()=>run({findExisting:async()=>true}),/EXISTING_FILE_REVIEW/);assert.equal(writes,0);
 await assert.rejects(()=>run({verifySavedAfterReload:async()=>({saved:false})}),/SAVE_UNCONFIRMED/);
 assert.equal((await run({})).results.length,1);
});

