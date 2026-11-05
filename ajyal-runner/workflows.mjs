// The login and OTP controls below were inspected on the real Ajyal site.
// Post-login destinations have NOT been inspected. Never invent selectors or
// enable uploading based on the fact that a file exists in this portal.
export const LOGIN = Object.freeze({
  url: 'https://ajyal.moe.gov.jo/emis/login.aspx',
  username: 'input[name="tMbPAN1"]',
  password: 'input[name="tMbPAR1"]',
  submit: '#bMtSMB1',
  otp: 'input[name="tbAuthenticationCode"]',
  otpSubmit: '#btnAudit',
});

// Populate only after reviewing the supplied guide AND validating the real UI.
// Each adapter must implement verifyAccount, selectDestination, verifyDestination,
// findExisting, uploadAndSave, and verifySavedAfterReload. They must match the
// account, school (when supplied), grade, section, subject, year and term.
// The generic runner enforces a second destination check immediately before save.
export const verifiedWorkflows = Object.freeze({});
export const setupMessage = 'الدخول ورمز التحقق متاحان للتجربة. الرفع الآلي غير مفعّل حتى مطابقة صفحات إضافة الخطط والتحليل والواجبات داخل أجيال.';
