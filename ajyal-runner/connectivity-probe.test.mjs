import test from 'node:test';import assert from 'node:assert/strict';import {probeBrowser,probeHttps} from './connectivity-probe.mjs';
test('network diagnostic refuses arbitrary destinations',()=>{assert.throws(()=>probeHttps('http://localhost'),/PROBE_TARGET_NOT_ALLOWED/);});
test('connectivity checks the fixed official login without filling or submitting anything',async()=>{
 let closed=0;const page={goto:async url=>{assert.equal(url,'https://ajyal.moe.gov.jo/emis/login.aspx');return {status:()=>200};},url:()=> 'https://ajyal.moe.gov.jo/emis/login.aspx',locator:()=>({isVisible:async()=>true})};
 const result=await probeBrowser({launch:async()=>({newContext:async()=>({route:async()=>{},newPage:async()=>page}),close:async()=>closed++})});
 assert.equal(result.loginForm,true);assert.equal(result.status,200);assert.equal(closed,1);
});
test('connection failures emit sanitized codes only',async()=>{
 const result=await probeBrowser({launch:async()=>{throw Error('private-value net::ERR_CONNECTION_TIMED_OUT');}});
 assert.equal(result.error,'ERR_CONNECTION_TIMED_OUT');assert.doesNotMatch(JSON.stringify(result),/private-value/);
});
