import test from 'node:test';import assert from 'node:assert/strict';
import {parseReport,joinReportPages} from './roster-reader.mjs';
const report=(page,rows)=>`كشف بأسماء الطلبة\nالصف : الثالث\nالمدرسة : مدرسة الاختبار\nالشعبة :أ\nالاسم\nالرقم الوطني\nم\n${rows.map(([name,n])=>`${name}\n1234567890\n${n}`).join('\n')}\n07/11/2026\n${page}/2`;
const first=parseReport(report(1,[['طالب أول',1],['طالب ثان',2]])),second=parseReport(report(2,[['طالب ثالث',3]]));
test('collects every page with contiguous indexes and discards national IDs',()=>{const r=joinReportPages([first,second],'معلمة الاختبار',{grade:3,section:'أ'});assert.equal(r.names.length,3);assert.doesNotMatch(JSON.stringify(r),/1234567890/);assert.equal(r.totalCount,3);});
test('fails closed on missing/repeated pages, gaps and mismatched identity',()=>{
 for(const pages of [[first],[first,first],[first,{...second,rows:[{name:'طالب ثالث',index:4}]}],[first,{...second,section:'ب'}]])assert.throws(()=>joinReportPages(pages,'معلمة الاختبار'));
 assert.throws(()=>joinReportPages([first,second],'معلمة الاختبار',{grade:2}));
 assert.throws(()=>joinReportPages([first,second],'معلمة الاختبار',{teacherName:'معلمة أخرى'}));
 assert.throws(()=>parseReport('لا يوجد تقرير'));
});
