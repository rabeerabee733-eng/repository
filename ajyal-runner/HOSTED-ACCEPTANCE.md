# Hosted Ajyal acceptance

## Scope and activation gate

The target is an independent browser host, followed by verified roster extraction,
PDF creation/delivery and individual plan, analysis and homework uploads. Do not
activate production queues or retire the local fallback until the entire agreed
acceptance sequence passes. A healthy runner HTTP endpoint does not establish
connectivity to Ajyal.

## First host: Frankfurt

- Service: `ajyal-upload-runner` (`srv-dbmh03lbedkc73e395sg`).
- Source: `7bb7e019a1d5f65c021e92fb8e37b8e2137dceb7`.
- Deployment: `dep-dbnpfdverlec73aspnt0`, live 2026-11-07 21:29 UTC.
- Health endpoint responds successfully.
- Fixed official-login probe: HTTPS timed out at 15.1 seconds; Chromium timed out
  at 48.7 seconds, logged at 2026-11-07 21:29:52 UTC.
- No account credentials, OTP, form submissions or uploads were used in this test.
- This is evidence of a connection failure from this host, not proof of a general
  ban on AI, a specific firewall rule, or a need to buy a larger compute plan.

## Second host: Oregon

A separate free acceptance instance, `ajyal-acceptance-oregon`
(`srv-dbnpgt7f3r2c7399sbp0`), was created with the same code and an independent
random API key held only in provider configuration. It is not connected to
production customer queues. Automatic deploys are off to keep the acceptance
source stable.

- Deployment `dep-dbnpgtff3r2c7399scag` became live at 21:32:30 UTC.
- Health endpoint returned HTTP 200.
- At 21:33:12 UTC, HTTPS timed out after 15.1 seconds and Chromium after
  48.2 seconds, before any login form was confirmed.
- No teacher credentials or student data were submitted to this host.

Both hosts run the HTTP service successfully but have not reached the official
Ajyal login form. This blocks authenticated acceptance, generation from a hosted
roster, delivery and upload verification. Do not describe migration as complete.

## Remaining acceptance

1. Reach the official login form from the intended host.
2. Authenticate the authorized test teacher and consume a fresh requested OTP.
3. Verify identity, grade/section and all pages of the student report through the
   authorized menu navigation already tested locally.
4. Generate both PDFs with the established templates and cover fonts.
5. Send only to a verified originating/explicitly selected test conversation,
   checking actual API acceptance and avoiding uncertain duplicate sends.
6. Inspect existing Ajyal resources; validate one plan, analysis and homework
   before enabling adapters or bulk processing.
7. Choose a continuously running production compute plan only after host access
   works; the free acceptance instance sleeps and is not production capacity.

## Network isolation check

Source `13074b30c8ca71aa1903f8ddb7b3e19c14f775c6`, deployment
`dep-dbnpimtg1s2s73fr7o3g`, Frankfurt, logged 2026-11-07 21:35:59 UTC:

| Destination | DNS | TCP | TLS | Result |
| --- | --- | --- | --- | --- |
| Official Ajyal login | resolved | not established | not established | timeout, 15.0 s |
| Render HTTPS control | resolved | established | established | HTTP 200, 492 ms |
| Official Ajyal in Chromium | — | — | — | navigation timeout, 48.7 s |

This narrows the observed failure to establishing the network connection to
Ajyal from the tested host, before authentication or page parsing. It does not
identify which operator or firewall is responsible. CPU upgrades, password
changes and additional OTP requests have no demonstrated benefit for this error.

To continue, obtain a provider-supported working connection to Ajyal: ask the
hosting/platform support teams to diagnose the tested source/destination route,
or validate an independent authorized host that can load the official login.
Hosting in Jordan is a candidate to test, not a verified solution. Keep Karam's
existing server and unactivated local fallback available in the meantime.

Suggested support request (not sent):

> Our authorized Ajyal automation cannot establish TCP to
> https://ajyal.moe.gov.jo/emis/login.aspx from Render Frankfurt and Oregon.
> DNS resolves. An HTTPS control request succeeds with HTTP 200. Both Node HTTPS
> and Chromium navigation time out before authentication. Please verify routing
> and any supported source-IP/network requirements for the official service.
> We can supply timestamps and provider egress ranges through your support channel.

No production extraction flag was enabled, no paid compute subscription was
created, and no teacher credentials were submitted during the hosted tests.
The two acceptance services remain free test instances, not a completed migration.
