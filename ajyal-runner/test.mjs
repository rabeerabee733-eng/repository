import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createRunner} from './server.mjs';
import {officialUrl,uploadItems} from './engine.mjs';

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
