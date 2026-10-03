# Cloud deployment for the classroom demo

**Status**: In Progress

## Summary

Deploy the existing website to Vercel, the Python API to one Render Docker
service, and the knowledge graph to Neo4j Aura. Reuse the trained models and
dated forecasts. Keep the local presentation working with its current defaults.

## Context and decision

The user accepted this hosting arrangement on 2026-10-08. The existing Vite
proxy, API host checks, graph connection and snapshot writes assume localhost.
Use configuration to support both environments, without a model or UI rewrite.
The deployment is a small invited classroom demo, not an unrestricted public
investment service. The user chose free hosting only on 2026-10-08. Use Render Free and AuraDB Free;
no paid instance or disk is authorized. Existing OpenAI usage is separate.

Implementation uses the architecture and development workflows. No new
application framework or authentication vendor is needed for a shared demo
access code. The code is an admission credential, not a user account system.

## Requirements

- AC-1: The four website chapters load from Vercel, using the existing build.
- AC-2: Chat reaches the hosted API, with exact HTTPS origins and host names.
- AC-3: Hosted chat and refresh require a server configured demo code. It never
  enters Git, built JavaScript, URLs or logs. The browser retains it in memory.
- AC-4: Accepted chat attempts have a durable global daily and minute quota.
  No questions, answers, IPs or credentials are stored in the quota database.
- AC-5: Each Render restart restores the same packaged forecasts and checkpoints.
  Cloud refresh is disabled because the free filesystem is ephemeral. Aura retains
  quota counters across restarts. Startup does not train.
- AC-6: Neo4j and OpenAI credentials are backend environment variables only.
- AC-7: Localhost defaults and the existing presentation continue to work.
- AC-8: Publish only after offline checks, container checks where available,
  and a real hosted connection check. Report any unverified external step.

## Value sourcing

| Value | Source |
| --- | --- |
| Frontend API address | VITE_API_BASE_URL, HTTPS Render URL at Vercel build time |
| Allowed origins | A6_ALLOWED_ORIGINS, exact Vercel production URL |
| Allowed hosts | A6_ALLOWED_HOSTS plus Render's RENDER_EXTERNAL_HOSTNAME |
| Deployment mode | A6_ENV, local by default, production in Render |
| Demo code | CHAT_DEMO_CODE, generated secret of at least 24 characters |
| Chat quotas | CHAT_DAILY_LIMIT (100), CHAT_MINUTE_LIMIT (5) |
| Runtime folder | FPT_DAILY_HOME, /tmp/sequence/daily on Render |
| Export folder | A6_PUBLIC_DATA_DIR, /tmp/sequence/public on Render |
| Seed forecasts | The two committed website/public/data FPT JSON files |
| Forecast weights | Existing daily/outlook artifacts, hash verified |
| Graph and LLM settings | Existing NEO4J_* and OPENAI_* environment settings |

## API and security

Preserve existing API response formats. Add GET /healthz with no external calls.
Require X-Demo-Access-Code on /api/chat paths and the refresh POST when configured.
Production must fail closed if the code or explicit HTTPS origins are absent.
Keep exact origin checks on mutating routes; CORS permits only configured sites.
No cookie authentication. A 401 response opens an inline access form in chat.
Invalid codes never trigger Neo4j retrieval or OpenAI requests.

Reserve chat quota after validation and the existing concurrency/cooldown checks,
before calling OpenAI. In production, Aura transactions lock a dedicated node
before checking Vietnam calendar day and UTC minute buckets. Commit both counts
before calling OpenAI; failures consume an attempt. Return 429 when capped and
503 if durable reservation fails. Never use a local fallback in production.
Delete expired quota buckets after accepted reservations. Local SQLite remains.

One Render instance and one Uvicorn worker preserve existing refresh/chat locks.
The free plan supports one instance; a future scale change needs shared
refresh/concurrency locks and persistent forecast storage design. This is deliberate for the classroom demo.

## Persistence and migration

No existing graph is deleted or copied wholesale. Point the current parameterized
graph importer to a dedicated Aura database; it imports the same evidence on use.
Separate read-only seed JSON from writable exports. Bootstrap initializes an
empty runtime using the packaged checkpoint and never overwrites an active run.
Keep the local default paths. Set cloud paths through environment configuration.
Vercel's static historical demo stays dated; live chat uses the backend snapshot.

## Build plan

- [x] Add deployment settings, authentication, quota and health endpoint (AC-2/3/4/6/7).
- [x] Separate seed files from writable forecasts and verify startup (AC-5/7).
- [x] Add frontend API configuration and access form (AC-1/2/3/7).
- [x] Add Docker, Render and Vercel configuration plus operator documentation (AC-1/5/6).
- [x] Run offline regression, artifact and container checks (AC-7/8).
- [ ] Connect accounts, deploy only free resources and verify the hosted app (AC-8).

## Consequences and rollback

Three hosting accounts are required. Render Free sleeps when idle and discards
local files on restart. The frontend allows a 75-second wake-up check without
overlapping status requests. AuraDB Free may need manual resume after inactivity. A daily request cap bounds calls,
not exact dollars; OpenAI account spend controls remain useful. Rotate the demo
code if it is shared outside the intended audience. Keep the local app as the
presentation fallback. No dependency on the cloud is added to local defaults.

## Verification

Exercise denied and accepted origins/codes, quota persistence and concurrent
reservations, absent production settings, seed bootstrap into an empty disk,
restart preservation, and forecast checkpoint compatibility. Build the frontend
with a remote API URL and verify it contains no secret. Hosted acceptance must
include a real chat response with citations and a post-restart status check.

Verification on 2026-10-08: 46 frontend tests passed; 49 Python tests ran,
48 passed and one optional live graph test was skipped. Production build and
formatting passed. Linux ARM64 Docker build and isolated startup/restart checks
passed with about 324 MB resident API memory. Linux AMD64 hosted build and
actual cloud integration remain to be verified.

Free-tier revision: hosted refresh is disabled, production quota uses Aura, and
Render has no disk. 52 offline Python tests ran (50 passed, two optional graph tests skipped); the
new live local graph quota concurrency/persistence test passed separately.
46 frontend checks, formatting and build passed. The ARM64 container passed
startup, authenticated status and restart with a 512 MB memory/no-swap limit
(about 329 MiB resident). Hosted AMD64 behavior remains to be verified.

Cloud rollout on 2026-10-08: the Linux AMD64 image built and started on Render
Free; `/healthz` passed and the service became live. Vercel production is
https://sequence-rnn.vercel.app and uses https://sequence-fpt-api.onrender.com.
Shopee, FPT, summary and chat pages loaded. Chat rejected an invalid access code
and accepted the generated code; the packaged snapshot is dated 2026-10-07.
After redeploying commit `eb23799`, the API restored the same 2026-10-07 snapshot
and became live. The database check reported `AuthError` with
`Neo.ClientError.Security.Unauthorized`: the configured username/password pair
was rejected. This does not establish which credential is incorrect, and the
configured username `725759b9` has not been independently verified.
Readiness queries the configured database and logs only the exception class and an allowlisted
error code for diagnosis.

Follow-up on 2026-10-09: deployment `dep-db3sn9om7kps73fts06g` became live after
saving the edited Render variables and rebuilding. Chat remains blocked by
rejected database credentials; connected readiness and a real cited answer
remain pending. Aura's Recover credentials link opens instructions for creating
a new database user or cloning an instance, not a password reset or disclosure.
A filename-only search in Downloads found no original Aura credential download.
`SHOW USERS` through the signed-in Aura account returned access denied.
`SHOW CURRENT USER` returned the Aura account identity, which does not verify
the database username/password used by Render.
