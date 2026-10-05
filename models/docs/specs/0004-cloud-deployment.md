# Cloud deployment for the classroom demo

**Status**: Complete

## Summary

Deploy the existing website to Vercel, the Python API to one Render Docker
service, and the knowledge graph to Neo4j Aura. Reuse the trained models and
dated forecasts. Keep the local presentation working with its current defaults.

## Context and decision

The user accepted this hosting arrangement on 2026-10-08. The existing Vite
proxy, API host checks, graph connection and snapshot writes assume localhost.
Use configuration to support both environments, without a model or UI rewrite.
The deployment is a small classroom demo. On 2026-10-09 the user requested removal
of the demo access form and then all application question limits. Public chat
opens directly without daily/minute quotas or an artificial cooldown.
The user chose free hosting only on 2026-10-08. Use Render Free and AuraDB Free;
no paid instance or disk is authorized. Existing OpenAI usage is separate.

Implementation uses the architecture and development workflows. No new
application framework or authentication vendor is needed. An optional server
setting can still enable code protection for API clients.

## Requirements

- AC-1: The four website chapters load from Vercel, using the existing build.
- AC-2: Chat reaches the hosted API, with exact HTTPS origins and host names.
- AC-3: Hosted chat opens without a demo access code or access form. Optional
  API code protection is explicitly enabled on the server and fails closed when
  enabled without a valid code. No code enters frontend builds, URLs or logs.
- AC-4: Public chat has no application daily/minute quota or artificial cooldown.
  Optional limits require explicit server opt-in. Existing limit values alone do
  not enable them. Input validation, timeouts and processing locks remain.
- AC-5: Each Render restart restores packaged checkpoints and the latest validated
  published forecasts when GitHub is reachable, with a saved snapshot fallback.
  Direct cloud price fetching is disabled. Optional
  quota counters remain in Aura across restarts. Startup does not train.
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
| Public chat | CHAT_REQUIRE_ACCESS_CODE, false by default and in Render |
| Optional API code | CHAT_DEMO_CODE, 24 to 128 characters, only used when protection is true |
| Question limits | CHAT_ENFORCE_LIMITS, false by default and in Render |
| Optional chat quotas | CHAT_DAILY_LIMIT (100), CHAT_MINUTE_LIMIT (5), only used when limits are true |
| Runtime folder | FPT_DAILY_HOME, /tmp/sequence/daily on Render |
| Export folder | A6_PUBLIC_DATA_DIR, /tmp/sequence/public on Render |
| Seed forecasts | The two committed website/public/data FPT JSON files |
| Forecast weights | Existing daily/outlook artifacts, hash verified |
| Graph and LLM settings | Existing NEO4J_* and OPENAI_* environment settings |

## API and security

Preserve existing API response formats. Add GET /healthz with no external calls.
Public chat requires no credential, even if a legacy CHAT_DEMO_CODE remains set.
When CHAT_REQUIRE_ACCESS_CODE=true, require X-Demo-Access-Code on /api/chat paths
and the refresh POST. Protected mode fails closed if its code is invalid or absent.
Production always requires explicit HTTPS origins.
Keep exact origin checks on mutating routes; CORS permits only configured sites.
No cookie authentication or browser access form. In optional protected mode,
invalid codes never trigger Neo4j retrieval or OpenAI requests.

Default public mode bypasses quota storage and the three-second cooldown, even
with legacy daily/minute limit environment values. Provider account settings and
limits are unchanged. The existing processing lock, validation and timeouts remain.

Only when CHAT_ENFORCE_LIMITS=true, apply the cooldown and reserve chat quota
after validation/concurrency checks, before calling OpenAI. In production,
Aura transactions lock a dedicated node
before checking Vietnam calendar day and UTC minute buckets. Commit both counts
before calling OpenAI; failures consume an attempt. Return 429 when capped and
503 if durable reservation fails. Never use a local fallback in production.
Delete expired quota buckets after accepted reservations. Local SQLite remains.

One Render instance and one Uvicorn worker preserve existing refresh/chat locks.
The free plan supports one instance; a future scale change needs shared
refresh/concurrency locks and persistent forecast storage design. This is deliberate for the classroom demo.

## Persistence and migration

### Daily publication, authorized 2026-10-10

Use a scheduled GitHub Actions job on the public repository at 16:30 and 18:30
Vietnam time each weekday, plus manual dispatch. Standard Ubuntu runners keep
hosting free. Running only inside Render was rejected because Free sleeps and
loses local files; a paid disk or cron service is outside the agreed scope.

The job fetches the existing pinned KBS/Vnstock source once, applies the existing
16:00 Vietnam completion cutoff, and runs the frozen daily and three outlook
checkpoints. Never retrain. If the complete close history hash is unchanged,
publish nothing. Reject older source dates and older same date revisions.

Commit the two existing public JSON files and one `fpt-published.json` containing
both forecasts and the complete ledger together. Regenerate the source ZIP.
The job uses only its repository token for publishing. No market CSV, API key,
chat transcript or new checkpoint is committed. Serialize runs and use an
ordinary push so concurrent repository edits cannot be overwritten.

Production reads that single bundle from this repository's fixed HTTPS raw URL
at startup and on demand, at most once per five minutes with a three second
network timeout and a two MiB response cap. Validate symbol, units, source,
dates, positive finite prices, forecast arithmetic, complete horizons, and
unchanged model metadata against the bundled models before activation. Retain
the last accepted bundle on any fetch or validation failure. Persist with an
atomic file replacement; packaged data is the cold start offline fallback.
Carry the matching outlook inside each daily read so one chat cannot combine
different publication generations. Local mode stays independent by default.
`FPT_PUBLISHED_UPDATES=false` disables synchronization for rollback.

Values retain their sources: price and date come from cleaned provider closes;
predictions come from saved checkpoint inference with saved normalization;
model metrics remain the original held out evaluation; publication time is the
job's Vietnam clock; freshness is calculated from the observed data date.
Company evidence remains manually curated at its own review date.

Acceptance: newer and revised same date bundles reach status/chat coherently;
older, malformed and timed out updates preserve prior data; unchanged input
does not create a commit; restart restores a valid bundle; weights never change.
Build and verify the publisher, consumer, scheduled workflow and hosted refresh
as one complete path. No scope row exists for this enhancement.

GitHub scheduling is best effort and can be delayed. Public repository schedules
can stop after 60 days without activity. Holidays retain the last genuine close.
Sources: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
and https://docs.github.com/en/billing/concepts/product-billing/github-actions.

Graph import does not delete or copy an existing graph wholesale. Point the
current parameterized graph importer to a dedicated Aura database; it imports
the same evidence on use.
Separate read-only seed JSON from writable exports. Bootstrap initializes an
empty runtime using the packaged checkpoint and never overwrites an active run.
Keep the local default paths. Set cloud paths through environment configuration.
Vercel's static historical demo stays dated; live chat uses the backend snapshot.

## Build plan

- [x] Add deployment settings, authentication, quota and health endpoint (AC-2/3/4/6/7).
- [x] Separate seed files from writable forecasts and verify startup (AC-5/7).
- [x] Add frontend API configuration and direct public chat access (AC-1/2/3/7).
- [x] Add Docker, Render and Vercel configuration plus operator documentation (AC-1/5/6).
- [x] Run offline regression, artifact and container checks (AC-7/8).
- [x] Connect accounts, deploy only free resources and verify the hosted app (AC-8).

## Consequences and rollback

Three hosting accounts are required. Render Free sleeps when idle and discards
local files on restart. The frontend allows a 75-second wake-up check without
overlapping status requests. AuraDB Free may need manual resume after inactivity.
OpenAI usage remains separately metered, with its existing account settings.
Keep the local app as the
presentation fallback. No dependency on the cloud is added to local defaults.

## Verification

Exercise code-free public access without quota/cooldown, denied and accepted
origins, optional protected API codes and optional quota persistence/concurrent
reservations, absent production settings, seed bootstrap into an empty disk,
restart preservation, and forecast checkpoint compatibility. Build the frontend
with a remote API URL and verify it contains no secret. Hosted acceptance must
include a real chat response with citations and a post-restart status check.

Verification on 2026-10-08: 46 frontend tests passed; 49 Python tests ran,
48 passed and one optional live graph test was skipped. Production build and
formatting passed. Linux ARM64 Docker build and isolated startup/restart checks
passed with about 324 MB resident API memory. These initial checks were followed
by the successful hosted AMD64 build and chat verification recorded below.

Free-tier revision: hosted refresh is disabled, production quota uses Aura, and
Render has no disk. 52 offline Python tests ran (50 passed, two optional graph tests skipped); the
new live local graph quota concurrency/persistence test passed separately.
46 frontend checks, formatting and build passed. The ARM64 container passed
startup, authenticated status and restart with a 512 MB memory/no-swap limit
(about 329 MiB resident). Hosted AMD64 build, startup and chat subsequently passed.

Cloud rollout on 2026-10-08: the Linux AMD64 image built and started on Render
Free; `/healthz` passed and the service became live. Vercel production is
https://sequence-rnn.vercel.app and uses https://sequence-fpt-api.onrender.com.
Shopee, FPT, summary and chat pages loaded. Chat rejected an invalid access code
and accepted the generated code; the packaged snapshot is dated 2026-10-07.
After redeploying commit `eb23799`, the API restored the same 2026-10-07 snapshot
and became live. The database check reported `AuthError` with
`Neo.ClientError.Security.Unauthorized`: the configured username/password pair
was rejected. This did not establish which credential was incorrect, and the
earlier configured username `725759b9` was not independently verified.
Readiness queries the configured database and logs only the exception class and an allowlisted
error code for diagnosis.

Follow-up on 2026-10-09: deployment `dep-db3sn9om7kps73fts06g` became live after
saving the edited Render variables and rebuilding. At that point, chat remained
blocked by rejected database credentials. Aura's Recover credentials link opens
instructions for creating a new database user or cloning an instance, not a
password reset or disclosure. A filename-only search in Downloads found no
original credential download for instance `725759b9`.
`SHOW USERS` through the signed-in Aura account returned access denied.
`SHOW CURRENT USER` returned the Aura account identity, which does not verify
the database username/password used by Render.
Free-tier console SSO admins lack database user-management privileges, so that
session cannot use the generic `CREATE USER` recovery option.

The user explicitly approved deletion of the empty instance `725759b9` and its
replacement on 2026-10-09. The old instance was deleted and a new AuraDB Free
instance was created. The official credential download confirmed instance ID,
username and database `15fb6283`, with URI
`neo4j+s://15fb6283.databases.neo4j.io`. Aura showed Running on the Free tier with
zero nodes. The official file `Neo4j-15fb6283-Created-2026-10-08.txt` was saved in
Downloads, alongside an exact private copy, `sequence-neo4j-credentials.txt`,
with file permissions `0600`. All four Render connection fields were checked
against the official file before the save/rebuild/deploy step.
Deployment `dep-db3t1mp42hec73ev7rug` became live with those verified settings.
No password is recorded in these docs.

Hosted chat verification on 2026-10-09 passed on the public Vercel site. The UI
showed `Đã kết nối` and the packaged 2026-10-07 closing price of 59,700 VND.
The synthetic acceptance prompt was: “Tôi có 200 triệu và muốn tìm hiểu FPT
trong khoảng 6 tháng, tôi nên cân nhắc điều gì?” It returned a Vietnamese answer
with citations `H6`, `B2`, `B3`, `B5` and `B6`. Opening `H6` showed the matching
126-session experimental forecast of 70,258.70352518994 VND and its limitations.
A read-only Aura query confirmed the 2026-10-09 daily quota counter was `1`.
Render restart created fresh instance `xhxkg` at 00:24:21 ICT on 2026-10-09;
startup completed at 00:24:28. It restored bundled run
`20261007T114039-e90d31` with source date 2026-10-07. A manual public-site
connection check again showed `Đã kết nối`, Neo4j connected, and the unchanged
59,700 VND closing price. A second read-only Aura query confirmed
`sequence-chat:day:2026-10-09` still held `1` request. Hosted chat, snapshot
restoration and quota persistence across restart are verified.
