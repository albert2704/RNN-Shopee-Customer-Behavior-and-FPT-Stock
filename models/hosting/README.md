# Cloud deployment

Use Vercel for `website/`, one Render Free Docker web service for the API, and a
dedicated Neo4j AuraDB Free database. Startup checks the shipped models without
training or downloading new market data. Local defaults remain unchanged.

Production website: **https://sequence-rnn.vercel.app**

API: **https://sequence-fpt-api.onrender.com**

For the classroom demo, open [Hỏi đáp](https://sequence-rnn.vercel.app/#hoi-dap)
and ask a question. No demo access code, application daily/minute quota, or
artificial question cooldown is enabled.

## Render API

The root `render.yaml` uses the Free plan (512 MB), with no paid disk. Build
context is the repo root; Dockerfile is `models/hosting/Dockerfile`. Do not set
Root Directory. Runtime files in `/tmp/sequence` are disposable: every new
instance restores packaged checkpoints and the fallback publication.
`A6_ALLOW_REFRESH=true` enables the background refresh requested on website entry.
The provider process imports lightweight file helpers, without a second Torch runtime.

Render Free sleeps after 15 minutes idle; the first request can take about a
minute to wake it. Open Hỏi đáp before presenting. The connection check waits up
to 75 seconds and avoids overlapping polls. See [Render's free limits](https://render.com/docs/free).

Configure these server variables in Render, never in frontend code:

| Variable | Value |
| --- | --- |
| `A6_ENV` | `production` |
| `A6_ALLOW_REFRESH` | `true`; enable website-entry refresh |
| `FPT_PUBLISHED_UPDATES` | `true`; serve one atomic daily/outlook publication |
| `A6_ALLOWED_ORIGINS` | Exact Vercel HTTPS production origin |
| `CHAT_REQUIRE_ACCESS_CODE` | `false` (default); public chat needs no code |
| `CHAT_ENFORCE_LIMITS` | `false` (default); no application question-count caps or cooldown |
| `OPENAI_API_KEY` | The project's OpenAI API key |
| `OPENAI_MODEL` | `gpt-4.1-mini` or a compatible configured model |
| `NEO4J_URI` | Aura's `neo4j+s://...` connection URI |
| `NEO4J_USERNAME` | Exact username from Aura's generated credentials |
| `NEO4J_PASSWORD` | Aura database password |
| `NEO4J_DATABASE` | Exact database name shown in Aura Query |

Render supplies `RENDER_EXTERNAL_HOSTNAME`. API custom domains can be added
with `A6_ALLOWED_HOSTS`. Wildcard origins and hosts are rejected.

Use one instance and one Uvicorn worker, which preserves existing locks.
`CHAT_ENFORCE_LIMITS=false` bypasses quota storage and the artificial cooldown;
legacy `CHAT_DAILY_LIMIT` and `CHAT_MINUTE_LIMIT` values are ignored. Input
validation, request timeouts, and the lock while an answer is running remain.
Provider-side availability and account limits are unchanged.

Optional application limits can be enabled with `CHAT_ENFORCE_LIMITS=true`.
That mode applies a three-second cooldown and durable daily/minute quotas,
configured with `CHAT_DAILY_LIMIT` (100) and `CHAT_MINUTE_LIMIT` (5). Production
reservations use Aura transactions and fail closed if quota storage is unavailable;
local mode uses SQLite. No conversation, credential or IP is stored in quota records.

`/healthz` is a fast health probe without external calls. Public
`/api/chat/status` checks graph/data availability. A real question verifies the
OpenAI key. Never bake secrets into images or Docker build arguments.

Optional API protection remains available with `CHAT_REQUIRE_ACCESS_CODE=true`
and a server-only `CHAT_DEMO_CODE` of 24 to 128 characters. Protected API clients
must send `X-Demo-Access-Code`; the public website no longer has a code form.
Public mode ignores any previously saved code. Existing Render deployments can
deploy this revision without deleting that secret; an explicitly configured
`CHAT_REQUIRE_ACCESS_CODE=true` must be changed to `false` for the public website.
Likewise, public uncapped operation requires `CHAT_ENFORCE_LIMITS` to be absent
or `false`; no quota environment values need deletion.

## Vercel website

Import the GitHub repository. Set Root Directory to `website`, framework to
Vite, build command to `npm run build`, output directory to `dist`.
Set `VITE_API_BASE_URL` to the Render HTTPS origin, with no `/api` suffix.
Redeploy after changing this public variable. No credential goes into `VITE_*`.
The app uses hash routes, so no SPA catchall rewrite is needed.

Add the resulting stable production URL to Render's `A6_ALLOWED_ORIGINS`.
Preview URLs need their own explicit entry; never allow all `*.vercel.app` sites.
Open Hỏi đáp directly; the browser does not need a shared credential.

## Neo4j Aura

Select the **Free** tier, not the 14-day Professional trial, and save its
connection details outside the repo. Free databases pause after 72 hours idle;
resume from Aura before presenting. See [Aura instance actions](https://neo4j.com/docs/aura/managing-instances/instance-actions/).
The current graph importer creates the existing indexes and imports versioned
reference evidence on first use. It never stores questions or chat history.
Do not activate a paid trial subscription for this deployment.
Verify the username and database separately; an instance ID or database name
does not establish the login username. Match the generated credentials and Query menu.
`Neo.ClientError.Security.Unauthorized` means the configured credential pair was
rejected; it does not identify whether the username or password is wrong.
Aura's Recover credentials link opens [recovery instructions](https://neo4j.com/docs/aura/getting-started/connect-instance/)
for creating a new user or cloning an instance; opening it does not reveal or
reset the original password.
The new-user option requires database user-management privileges. A Free-tier
console SSO admin does not receive those privileges, so console access alone
cannot perform that recovery. See [Aura's role table](https://neo4j.com/docs/aura/user-management/).

Replacement instance `15fb6283` is Running on the Free tier. Its official
credential download verifies the username and database as `15fb6283`; use the
private `Downloads/sequence-neo4j-credentials.txt` copy for server setup.
Hosted readiness, a real cited answer and restart persistence passed on 2026-10-09.

## Price updates and operations

Deployment shows the actual observed closing date. Opening the website requests
one background refresh; cached evidence remains usable while it runs. Chat reads
the matching daily and longer-horizon forecasts. The historical classroom charts
remain fixed. Startup, health checks, status reads and chat messages do not fetch
market data.

Render automatic application deployment is off so a Git push does not interrupt
the demo API. Blueprint configuration changes may still auto-sync; keep the plan
set to `free` and do not add a disk. OpenAI API usage remains separately metered;
free hosting does not make the model API free. Keep local
`python -m chat.local_site start` available as a presentation fallback.

## Verification

From models:

```sh
.venv/bin/python -m unittest hosting.test_hosting chat.test_chat chat.test_investment daily.test_daily daily.test_published daily.test_visits outlook.test_outlook
```

From website, run `npm run test:logic`, `npm run format:check`, `npm run build`.
From the repo root, build with:

```sh
docker build -f models/hosting/Dockerfile -t assignment6-cloud:local .
```

Before sharing, verify all four chapters, chat without an access code,
denied origins, one real cited chat answer, and the same data date after restarting
the backend.

Public chat passed on 2026-10-09: the UI connected, showed the 2026-10-07 snapshot
at 59,700 VND, and answered a synthetic six-month FPT question in Vietnamese with
citations `H6`, `B2`, `B3`, `B5` and `B6`. The opened `H6` source matched the
126-session forecast and stated its limitations. After a Render restart, the
public UI reconnected with the same snapshot and price; the Aura daily quota
counter remained `1`, confirming persistence across restart.

## Updates on website entry

`Shell.tsx` calls `refreshOnVisit()` once per document, including React StrictMode.
It POSTs `/api/fpt/visit`, then polls the read-only GET only while work is running.
Navigation, tab focus and chat messages never start another update. The chat
reference price reloads after completion; existing answers keep their own citations.

`daily/visits.py` shares one background job among concurrent visitors. Nearby
visits reuse its result for five minutes; crossing 16:00 Vietnam time allows a
fresh attempt even within that interval. This is request deduplication, not a
schedule: no visitors means no provider calls. Failures are also deduplicated.

The existing pinned KBS/Vnstock adapter excludes today's bar before 16:00 and
validates prices and dates. `pipeline.refresh()` reuses all four frozen checkpoints,
rejects older cutoffs, skips inference for unchanged data, and activates daily,
outlook and ledger in one validated atomic publication. Ordinary reads do not
pull GitHub. Provider timeout, invalid data or failed inference retains the
previous publication. No new API credential or paid hosting resource is needed.

Render Free's temporary disk is lost on sleep/restart. The next instance restores
the packaged snapshot and a visitor triggers another fetch. The runtime forecast
ledger is therefore not a durable performance record across restarts.
The manual **Publish FPT snapshot manually** GitHub workflow can update the
packaged fallback and source ZIP; it has no cron trigger. Company disclosures
and historical teaching charts are not updated by this task.

Verification: a real KBS fetch and all four frozen forecasts completed in about
nine seconds inside a Linux container limited to 512 MiB (324 MiB measured peak).
Provider CSVs are read with round-trip float precision so their hashes remain
stable; the regression includes the value `32159.999999999996`.
