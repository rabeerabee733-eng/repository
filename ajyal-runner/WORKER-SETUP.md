# Local Karam assessment worker

This branch adds assessment roster extraction only. Plan, content-analysis and
homework upload adapters remain disabled and require separate live validation.

## Pairing and activation

Install Node 22+, Chrome and locked dependencies (`npm ci --ignore-scripts`).
Use the current Windows user's `%LOCALAPPDATA%\AltahdirAjyal` folder.
Set `worker-config.json` to `{"server":"https://altahdir-ai-agent.onrender.com"}`.
Generate a cryptographically random 48-byte worker token, set the same value in
Karam's `AJYAL_LOCAL_WORKER_TOKEN` environment variable, and protect its UTF-8
bytes with Windows DPAPI CurrentUser. Write only the base64 protected value to
`worker-token.dpapi`. Never commit tokens or pass them as command-line arguments.
Keep `AJYAL_ASSESSMENT_WORKER_ENABLED=false` until live acceptance passes.

`node verify-local.mjs` opens a new Chrome window. Sign into an authorized teacher
account once. The program then navigates to the observed student report, selects
the only class/section (or refuses ambiguity), reads every report page, checks
continuous sequence numbers and reports the roster count and hash. National IDs
are discarded before any report data leaves the parser.

The acceptance window remains open for safe retries for 30 minutes. Its stdin
commands are `status`, `navigation`, `open-reports`, `report`, and `close`.
Diagnostics expose only login-stage booleans, URL paths and the three report
navigation links; they never dump page bodies, national IDs or form values.

After verified extraction and server deployment, set
`AJYAL_ASSESSMENT_WORKER_ENABLED=true`. Run `start-worker.ps1` and
`install-startup.ps1` to start now and again at Windows login. No admin account,
public listener, regular Chrome profile or Windows power-setting changes are
needed. The computer must remain powered, signed in and online. To disable
processing immediately set the server flag to false; remove the named Startup
shortcut to stop automatic startup.

## Processing

The worker polls outbound HTTPS every 15 seconds. The server claims one active,
paid assessment request at a time, only during the customer's WhatsApp reply
window. Credentials and OTP stay in process memory; no browser profile persists.
A real visible OTP form triggers Karam's existing one-use teacher form. The
teacher must supply the current code within five minutes. CAPTCHA, bad login,
incomplete reports and ambiguous classes stop the job for review. Manager retry
can fill a missing grade/section but cannot change a previously chosen class.
Cancellation, changed credentials or expired leases prevent further access.

The accepted roster is encrypted by Karam, rendered using the original Site's
PDF templates and Thmanyah cover fonts, and sent as two PDFs only to the request's
originating conversation. Accepted or uncertain WhatsApp sends are never blindly
repeated. Roster data is purged after delivery. Payment approval remains a verified
manager operation; an uploaded receipt alone cannot activate a subscription.

`worker-status.log` contains only status codes and is truncated at startup.
Repeated unchanged status codes are suppressed. Do not log credentials, OTPs,
student names, national IDs, report bodies or browser traces.

## Verification

Run `node --test test.mjs roster-reader.test.mjs`. The Karam repository additionally
covers worker token authorization, lease expiry, cancellation, class matching,
one-use OTPs, complete roster validation and delivery to the originating sender.
Passing these tests is not evidence that a live WhatsApp delivery or Ajyal upload
has occurred. Record actual acceptance separately before advertising readiness.

## Live roster acceptance — 2026-11-08, Amman

An authorized teacher signed in manually on the local Windows acceptance browser.
The program followed Reports > Student Reports > Student Names, selected the
available class/section and validated a complete 21-student roster for grade 1.
The bare report URL had redirected to NotAuthorized.aspx; using the account's
normal report-menu links succeeded. The reader now follows those links and
expands the Student Reports group when the report link is collapsed.

This verifies local report navigation and extraction. It does not verify the
worker's automatic password/OTP exchange, live WhatsApp delivery, hosted-browser
connectivity, or plan/homework uploads. The subsequent local activation and its
remaining acceptance limits are recorded below.


## Local activation — 2026-11-08, Amman

The user authorized Karam to use the existing Windows computer for assessment
processing. The paired local worker was updated and restarted; its Startup
shortcut remains installed. Only `AJYAL_ASSESSMENT_WORKER_ENABLED` was changed
to `true` on the existing Karam service. No additional paid infrastructure was
created. Existing payment approval, eligibility and WhatsApp reply-window rules
remain in force; this activation does not make customer subscriptions free.

Evidence:
- Render deployment `dep-dbnpsdjrjlhs739hdd6g` reached `live` with the existing
  Karam application commit `8fd9133681e4679709fd2e719829b6ef79684450`.
- The device's worker reported `READY_WAITING_FOR_REQUESTS` at
  `2026-11-07T21:56:26.412Z`, proving successful authenticated queue polling.
- Karam's `/health` returned HTTP 200 from the device.
- An isolated Chrome connectivity check reached the official Ajyal login with
  HTTP 200 and both login controls visible in 1,051 ms. No credentials were used.
- 27 targeted worker, OTP, cancellation, roster and document-delivery tests passed.
- An isolated generator check produced both PDFs for 21 synthetic students in
  approximately 6 seconds in the development runtime. This is not a measurement
  of the customer's computer or of the complete live workflow.

Operational scope: Ajyal login and roster extraction run on Windows; document
rendering and WhatsApp delivery use the existing Karam service and the original
cover fonts. The worker handles one eligible request at a time. Windows must
remain signed in, awake and online. The teacher supplies a fresh OTP when asked.
The first complete live password/OTP-to-WhatsApp transaction still needs an actual
eligible teacher request. Do not claim that such delivery has already passed.
Plan/homework upload automation remains disabled.
