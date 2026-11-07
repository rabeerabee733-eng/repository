export const REPORT_URL='https://ajyal.moe.gov.jo/emis/EduWavek12Portal/ReportPages/StudntNamesReport.aspx';
export const REPORT_FIELDS={grade:'#ctl00_PlaceHolderMain_oDistributionSearch_ddlClass',section:'#ctl00_PlaceHolderMain_oDistributionSearch_ddlSection',view:'#ctl00_PlaceHolderMain_ibtnView',identity:'#ctl00_oHeader_lnkLoggedNewUserName'};
const fail=code=>{throw Object.assign(Error(code),{code});};
export const normalized=s=>String(s||'').normalize('NFKC').replace(/[أإآ]/g,'ا').replace(/[\u064b-\u065f]/g,'').replace(/\s+/g,' ').trim();
const digits=s=>s.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
const gradeNumber=s=>({'الاول':1,'الثاني':2,'الثالث':3}[normalized(s)]);
export function parseReport(text){
  const lines=digits(text).split(/\n/).map(s=>s.trim()).filter(Boolean);
  const header=lines.lastIndexOf('الاسم');
  if(header<0||lines[header+1]!=='الرقم الوطني'||lines[header+2]!=='م')fail('REPORT_NOT_READY');
  const meta=label=>lines.slice(0,header).reverse().find(s=>s.startsWith(label)&&s.includes(':'))?.split(':').slice(1).join(':').trim();
  const grade=gradeNumber(meta('الصف')),school=meta('المدرسة'),section=meta('الشعبة');
  if(!grade||!school||!section)fail('REPORT_METADATA_REQUIRED');
  const rows=[];let p=header+3;
  while(p+2<lines.length&&/^\d{10}$/.test(lines[p+1])&&/^\d{1,3}$/.test(lines[p+2])){
    const name=lines[p];if(!name||name.length>120||/\d/.test(name))fail('INVALID_REPORT_NAME');
    rows.push({name,index:Number(lines[p+2])});p+=3;
  }
  const footer=lines.slice(p).find(s=>/^\d{1,2}\s*\/\s*\d{1,2}$/.test(s));
  if(!footer||!rows.length)fail('REPORT_NOT_READY');
  const [page,pages]=footer.split('/').map(Number);
  if(page<1||pages<page||pages>10)fail('REPORT_PAGE_INVALID');
  // National IDs are deliberately discarded; they never leave this parser.
  return {grade,school,section,page,pages,rows};
}
export function joinReportPages(pages,teacherName,expected={}){
  if(!pages.length||pages.length!==pages[0].pages)fail('INCOMPLETE_ROSTER');
  const first=pages[0],rows=[];
  for(let n=0;n<pages.length;n++){
    const p=pages[n];
    if(p.page!==n+1||p.pages!==pages.length||p.grade!==first.grade||normalized(p.school)!==normalized(first.school)||normalized(p.section)!==normalized(first.section))fail('REPORT_MISMATCH');
    rows.push(...p.rows);
  }
  if(!rows.length||rows.length>50||rows.some((r,i)=>r.index!==i+1))fail('INCOMPLETE_ROSTER');
  if(expected.grade&&Number(expected.grade)!==first.grade||expected.section&&normalized(expected.section)!==normalized(first.section)||expected.school&&normalized(expected.school)!==normalized(first.school)||expected.teacherName&&normalized(expected.teacherName)!==normalized(teacherName))fail('ACCOUNT_OR_CLASS_MISMATCH');
  return {teacherName,school:first.school,grade:first.grade,section:first.section,year:'2026/2027',term:1,names:rows.map(r=>r.name),totalCount:rows.length,complete:true,verified:true,accountMatched:true,evidenceUrl:REPORT_URL};
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,stop,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(stop())fail('CANCELLED');const value=await fn().catch(()=>null);if(value)return value;await delay(200);}fail('REPORT_TIMEOUT');}
export async function readRoster(page,expected={},stopped=()=>false){
  // Ajyal issues its report destination through the authorized menu. Opening a
  // bare report URL can redirect a valid session to NotAuthorized.aspx.
  if(new URL(page.url()).pathname!==new URL(REPORT_URL).pathname){
    if(new URL(page.url()).pathname!=='/emis/EduWaveMenu/ReportsMenuPriv.aspx')await page.getByRole('link',{name:'التقارير',exact:true}).first().click({noWaitAfter:true});
    const reportLink=page.getByRole('link',{name:'كشف بأسماء الطلبة',exact:true});
    if(await reportLink.count()===0)await page.getByText('تقارير الطلبة',{exact:true}).first().click({noWaitAfter:true});
    await reportLink.first().click({noWaitAfter:true});
    await page.waitForURL(url=>url.pathname===new URL(REPORT_URL).pathname,{timeout:30000});
    await page.waitForLoadState('domcontentloaded');
  }
  if(new URL(page.url()).pathname!==new URL(REPORT_URL).pathname)fail('REPORT_LOGIN_REQUIRED');
  const identity=await page.locator(REPORT_FIELDS.identity).innerText();
  const teacherName=identity.split('\n')[0].trim();
  if(!teacherName||!identity.includes('معلم'))fail('TEACHER_IDENTITY_REQUIRED');
  if(expected.teacherName&&normalized(expected.teacherName)!==normalized(teacherName))fail('ACCOUNT_OR_CLASS_MISMATCH');
  const options=selector=>page.locator(selector).locator('option').evaluateAll(nodes=>nodes.filter(n=>!n.disabled&&!n.value.startsWith('-')&&n.value!=='').map(n=>({label:n.text.trim(),value:n.value})));
  const grades=await options(REPORT_FIELDS.grade);
  const grade=expected.grade?grades.find(g=>gradeNumber(g.label)===Number(expected.grade)):grades.length===1?grades[0]:null;
  if(!grade||!gradeNumber(grade.label))fail('CLASS_SELECTION_REQUIRED');
  await page.locator(REPORT_FIELDS.grade).selectOption(grade.value,{force:true});
  const sections=await until(async()=>{const s=await options(REPORT_FIELDS.section);return s.length?s:null;},stopped);
  const section=expected.section?sections.find(s=>normalized(s.label)===normalized(expected.section)):sections.length===1?sections[0]:null;
  if(!section)fail('CLASS_SELECTION_REQUIRED');
  await page.locator(REPORT_FIELDS.section).selectOption(section.value,{force:true});
  if(stopped())fail('CANCELLED');
  await page.locator(REPORT_FIELDS.view).click();
  const read=()=>page.locator('body').innerText().then(parseReport);
  let current=await until(read,stopped);
  while(current.page>1){const previous=current.page;await page.getByRole('button',{name:'chevron_right',exact:true}).click();current=await until(async()=>{const p=await read();return p.page===previous-1?p:null;},stopped);}
  const pages=[current];
  while(current.page<current.pages){const previous=current.page;await page.getByRole('button',{name:'chevron_left',exact:true}).click();current=await until(async()=>{const p=await read();return p.page===previous+1?p:null;},stopped);pages.push(current);}
  return joinReportPages(pages,teacherName,{...expected,grade:gradeNumber(grade.label),section:section.label});
}
