# Supervised local Ajyal acceptance

Requires Node 22+ and an existing Google Chrome installation. Install the locked
dependencies with `npm ci --ignore-scripts`, then run `node local-session.mjs`
or `start-local.cmd` on Windows.

The session opens a new visible, ephemeral Chrome context. Sign in directly on
the official page. The existing everyday Chrome profile is not read or modified.
No HTTP listener or remote-debugging TCP port is created; inspection commands use
the terminal's standard input. Credentials, cookies, and input values are not
serialized by the inspection command. Do not capture screenshots or inspect
private pages for unrelated purposes. The context closes after 30 minutes without
a terminal command; closing the program also closes the context.

Commands: `status`, `inspect`, `close`. Status only detects visible login/OTP
controls. A missing login form is NOT proof of authentication or account identity.
Inspection is restricted to the two official Ajyal origins. The program neither
submits forms nor uploads files. This is the local acceptance step before implementing
and enabling verified upload and roster adapters, not a completed Karam integration.

Do not enable production queues until an authorized teacher login, account and
destination match, and one saved resource have been verified in the actual UI.
The subsequent local worker must pull scoped jobs over an authenticated outbound
connection; no public port on the user's computer is required.
