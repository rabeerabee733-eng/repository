import {chromium} from 'playwright';import {createHash} from 'node:crypto';
import {officialUrl} from './engine.mjs';import {LOGIN} from './workflows.mjs';import {readRoster,REPORT_FIELDS} from './roster-reader.mjs';
const browser=await chromium.launch({channel:'chrome',headless:false});
const context=await browser.newContext({locale:'ar-JO',acceptDownloads:false});
await context.route('**/*',r=>officialUrl(r.request().url())?r.continue():r.abort());
const page=await context.newPage();page.setDefaultTimeout(15000);
try{
 await page.goto(LOGIN.url,{waitUntil:'domcontentloaded',timeout:45000});
 console.log(JSON.stringify({stage:'WAITING_MANUAL_LOGIN',next:'After sign-in, the program selects the class and reads every report page automatically.'}));
 await page.locator(REPORT_FIELDS.identity).waitFor({state:'visible',timeout:10*60000});
 const roster=await readRoster(page);
 console.log(JSON.stringify({stage:'AUTOMATIC_ROSTER_VERIFIED',teacherName:roster.teacherName,school:roster.school,grade:roster.grade,section:roster.section,totalCount:roster.totalCount,rosterSha256:createHash('sha256').update(JSON.stringify(roster.names)).digest('hex')}));
}catch(error){console.log(JSON.stringify({stage:'VERIFICATION_FAILED',error:error.code||error.name}));process.exitCode=1;}
finally{await browser.close();}
