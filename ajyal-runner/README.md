# Ajyal portal browser service

Node 22+ / Playwright 1.64.1. Deploy `Dockerfile` using this directory as build context. Set a randomly generated `RUNNER_API_KEY` of at least 48 characters through the hosting provider's secret environment settings. Never commit its value. `PORT` defaults to 10000 and listens on 0.0.0.0. `GET /health` has no private data; all `/v1/` routes require the bearer key.

One isolated, ephemeral browser session at a time. No passwords, OTPs, cookies or traces are persisted or logged. Idle/expired sessions are closed; terminal metadata is retained in memory for at most 75 minutes. Host restarts lose sessions, so the portal must reconcile and never silently retry an uncertain upload. Official Ajyal origin is the only permitted browser network destination. The browser does not bypass CAPTCHA, access restrictions, or alternative login challenges.

Login controls were observed on the live login page. **Post-login upload adapters are not configured or verified.** Upload mode fails closed. `login_check` sends no files, does not verify the account identity, and ends in `needs_setup` after the observed login/OTP UI completes. The supplied guide and actual authenticated screens are still required before activating uploads.

Run `npm test` for tests without real credentials or external browser access. No Playwright server is exposed. No paid resources are required by this source; the current trial is designed for a single free Render web service. Free hosting may cold-start or terminate sessions and is not a promise of uninterrupted background execution.
