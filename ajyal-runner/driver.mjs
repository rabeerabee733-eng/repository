import {LOGIN,verifiedWorkflows,setupMessage} from './workflows.mjs';
import {officialUrl,loginUrl,uploadItems} from './engine.mjs';

export async function browserDriver(job, update, stopped) {
  const {chromium} = await import('playwright');
  const browser = await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
  job.close = () => browser.close();
  if (stopped()) { await browser.close(); return; }
  const context = await browser.newContext({locale:'ar-JO',acceptDownloads:false,serviceWorkers:'block'});
  // No remote debugging endpoint, recordings, traces, cookies or passwords leave
  // this isolated session. All network destinations are limited to official Ajyal.
  await context.route('**/*', route => officialUrl(route.request().url()) ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const visible = s => page.locator(s).isVisible().catch(()=>false);
  const afterLogin = async () => {
    if (!officialUrl(page.url())) throw new Error('WRONG_ORIGIN');
    if (job.mode === 'login_check') {
      update('needs_setup', 'انتهت خطوة الدخول الظاهرة. التحقق من هوية الحساب والرفع يحتاجان مطابقة صفحات أجيال أولًا. لم يُرفع أي ملف.');
      await browser.close(); return;
    }
    update('verifying', 'جارٍ مطابقة الحساب والصف والشعبة والمادة.');
    await uploadItems({page,job,workflows:verifiedWorkflows,update,isStopped:stopped});
    if (!stopped() && job.results.length === job.manifest.items.length) update('completed','تم التحقق من حفظ جميع الملفات في أجيال.');
    await browser.close();
  };
  const observe = async () => {
    const deadline = Date.now()+30000;
    while (Date.now()<deadline && !stopped()) {
      if (!officialUrl(page.url())) throw new Error('WRONG_ORIGIN');
      if (await visible(LOGIN.otp)) {
        job.otpExpires = Date.now()+285000;
        update('waiting_otp','أجيال يطلب رمز التحقق المرسل إلى رقم صاحبة الحساب. أدخله هنا لإكمال الجلسة.');
        return;
      }
      if (!(await visible(LOGIN.username)) && !(await visible(LOGIN.password))) { await afterLogin(); return; }
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    if (!stopped()) throw new Error('LOGIN_NOT_CONFIRMED');
  };
  job.submitOtp = async code => {
    if (!loginUrl(page.url()) || !(await visible(LOGIN.otp))) throw new Error('OTP_NOT_REQUESTED');
    update('checking_otp','جارٍ تدقيق رمز التحقق في أجيال.');
    const previousExpiry=job.otpExpires;
    try {
      await page.locator(LOGIN.otp).fill(code);
      code='';
      await page.locator(LOGIN.otpSubmit).click();
      // Wait for a real response/change. Never treat clicking Audit as success.
      await page.locator(LOGIN.otp).waitFor({state:'hidden',timeout:15000}).catch(()=>{});
      if (await visible(LOGIN.otp)) {
        await page.locator(LOGIN.otp).fill('');
        job.otpExpires=previousExpiry;
        update('waiting_otp','لم يؤكد أجيال قبول الرمز. راجع الرمز وصلاحيته ثم أعد إدخاله.'); return;
      }
      job.otpExpires=null;
      if (await visible(LOGIN.password)) throw new Error('LOGIN_NOT_CONFIRMED');
      await afterLogin();
    } finally { code=''; }
  };
  update('connecting','جارٍ فتح منصة أجيال وإدخال بيانات الحساب.');
  await page.goto(LOGIN.url,{waitUntil:'domcontentloaded',timeout:45000});
  if (!loginUrl(page.url())) throw new Error('WRONG_ORIGIN');
  await page.locator(LOGIN.username).fill(job.credentials.username);
  await page.locator(LOGIN.password).fill(job.credentials.password);
  job.credentials=null;
  await page.locator(LOGIN.submit).click();
  await observe();
}

