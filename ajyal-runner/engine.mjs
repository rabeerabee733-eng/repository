export const ORIGIN = 'https://ajyal.moe.gov.jo';
export const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
export function officialUrl(value) {
  try { const u = new URL(value); return u.origin === ORIGIN && !u.username && !u.password; } catch { return false; }
}
export function verifiedMatch(actual, expected, keys) {
  return keys.every(k => clean(expected[k]) && clean(actual?.[k]) === clean(expected[k]));
}
export async function uploadItems({page, job, workflows, update, isStopped}) {
  const target = job.manifest;
  for (const item of target.items) {
    if (isStopped()) return;
    const adapter = workflows[item.kind];
    if (!adapter?.verified || !adapter.version) throw new Error('WORKFLOW_NOT_VERIFIED');
    if (!officialUrl(page.url())) throw new Error('WRONG_ORIGIN');
    const identity = await adapter.verifyAccount(page);
    if (!verifiedMatch(identity, target.account, ['username']) ||
        (target.account.school && !verifiedMatch(identity, target.account, ['school']))) throw new Error('ACCOUNT_MISMATCH');
    const expected = {grade:target.grade,section:target.section,year:target.year,term:target.term,subject:item.subject,kind:item.kind};
    await adapter.selectDestination(page, expected);
    const assertDestination = async () => {
      if (!officialUrl(page.url()) || !verifiedMatch(await adapter.verifyDestination(page), expected, Object.keys(expected))) throw new Error('DESTINATION_MISMATCH');
    };
    await assertDestination();
    // Ambiguous existing records require review. A title alone is not proof.
    const existing = await adapter.findExisting(page, item);
    if (existing) throw new Error('EXISTING_FILE_REVIEW');
    if (isStopped()) return;
    await assertDestination();
    update('uploading', 'جارٍ رفع الملف والتحقق من حفظه.');
    job.mayHaveWritten = true;
    await adapter.uploadAndSave(page, item, job.files.get(item.id));
    const evidence = await adapter.verifySavedAfterReload(page, item, expected);
    if (!evidence?.saved || !officialUrl(evidence.url) || !evidence.recordId || !evidence.verifiedAt ||
        !verifiedMatch(evidence, {filename:item.filename,...expected}, ['filename',...Object.keys(expected)])) throw new Error('SAVE_UNCONFIRMED');
    job.results.push({id:item.id,status:'completed',note:'تم التحقق من سجل الملف بعد إعادة تحميل وجهته في أجيال.',evidence:{...evidence,adapterVersion:adapter.version}});
  }
}
