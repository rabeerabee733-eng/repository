# Ajyal portal browser service

Node 22+ / Playwright 1.64.1. Deploy `Dockerfile` using this directory as build context. Set a randomly generated `RUNNER_API_KEY` of at least 48 characters through the hosting provider's secret environment settings. Never commit its value. `PORT` defaults to 10000 and listens on 0.0.0.0. `GET /health` has no private data; all `/v1/` routes require the bearer key.

One isolated, ephemeral browser session at a time. No passwords, OTPs, cookies or traces are persisted or logged. Idle/expired sessions are closed; terminal metadata is retained in memory for at most 75 minutes. Host restarts lose sessions, so the portal must reconcile and never silently retry an uncertain upload. Only the exact HTTPS origins `ajyal.moe.gov.jo` and `ajyallms.moe.gov.jo` are permitted browser network destinations. Password and OTP entry remain restricted to the login origin `ajyal.moe.gov.jo`. The browser does not bypass CAPTCHA, access restrictions, or alternative login challenges.

Login controls were observed on the live login page. **Post-login upload adapters are not configured or verified.** Upload mode fails closed. `login_check` sends no files, does not verify the account identity, and ends in `needs_setup` after the observed login/OTP UI completes. The supplied guide and actual authenticated screens are still required before activating uploads.

Run `npm test` for tests without real credentials or external browser access. No Playwright server is exposed. No paid resources are required by this source; the current trial is designed for a single free Render web service. Free hosting may cold-start or terminate sessions and is not a promise of uninterrupted background execution.

## Reliability update 0.2.1 — 7 November 2026

- The observed LMS origin can now load; the previous network policy blocked it.
- Session creation, login and OTP handlers re-check state after reading request bodies. Concurrent HTTP retries cannot start a second login, submit a code twice, overwrite an established session, or bypass the single-session limit.
- Expiry is checked at request time, including after a slowly arriving body, instead of relying solely on the periodic timer.
- Cancellation is re-checked immediately before a file write and after evidence verification. A cancelled operation cannot append a completed result.
- A failed/cancelled session that might have written exposes `requiresReview: true`. Expiry after a possible write explicitly calls for review before retrying. Existing `state` values and `mayHaveWritten` remain compatible.
- The Docker build runs the credential-free protocol and upload-gate tests.

Live acceptance remains pending: the available supervised browser timed out opening the official login page on 7 November. No new teacher files were uploaded. `verifiedWorkflows` is still empty: none of these fixes activates uploads or proves successful authentication. The Karam subscription service and this portal runner remain separate services; this release does not connect their queues.

Next acceptance step: open a fresh official login session, verify the intended teacher/account/grade/section, inspect existing resources, then validate one plan, one analysis and one homework through the real UI. Record evidence for each before enabling its adapter. Never request an OTP until the actual platform asks for it. Do not bulk-run, or retry a possibly saved item, on the strength of these synthetic tests.

