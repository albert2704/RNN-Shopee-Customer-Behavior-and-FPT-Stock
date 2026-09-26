# FPT investment outlook

**Date:** 2026-10-07
**Status:** Accepted
**Authorization:** User accepted the proposed one, three and six month models, company evidence retrieval and plain language stock assessments. Existing local API, Neo4j and OpenAI setup are reused.

## Requirements
1. Train separate direct RNN forecasts at 21, 63 and 126 recorded sessions, labelled approximate one, three and six months. Never compound tomorrow's forecast into a long horizon.
2. Evaluation uses later unseen dates, purges target overlap at split boundaries, and compares price errors and direction with simple baselines. Expose a separate sample of nonoverlapping forecast periods. No parameter selection on test.
3. Import dated official FPT reports and announcements, with public URLs, coverage period, publication date and bounded paraphrases, into the existing Neo4j corpus. State limitations and balance supporting facts with documented risks.
4. Chat can give a conditional assessment for a requested horizon using its actual model forecast and company evidence. Default language stays accessible, without MAE or automatic budget tables. Weak evaluation produces a cautious assessment with reasons and next things to watch, not a claim that longer horizon models do not exist.
5. Daily view shows a compact longer horizon section and company sources. Existing replay and next session model remain intact. Manual market refresh updates all frozen models, never retrains.
6. Tests cover causality, cutoff/hash consistency, missing/stale evidence, graph versioning and grounded multi turn answers. Package source and immutable model artifacts without raw market downloads, secrets or runtime data.

## Decision
Use the existing PyTorch RNN and trainer, hidden size 32, fixed seed 42 and existing Adam/early stopping settings. Lookback 60 daily log returns. Each horizon predicts log(Close[t+h]/Close[t]); convert to a price estimate using the observed anchor close. No probability or confidence interval is inferred from MAE.

Use chronological 70/15/15 origin regions. Purge training origins whose target is on/after the first validation origin and validation origins whose target is on/after the first test origin. Input normalization fits only returns used by training windows, target normalization fits training labels. Validation chooses the checkpoint. Test reports all origins and origins spaced at least h sessions apart. Compare persistence and mean horizon return from training. Overlapping test windows are not independent.

Corporate action adjustment remains unconfirmed in the existing KBS/Vnstock close source. These are experimental price change forecasts, not adjusted total return estimates. Sparse independent periods and a single stock limit conclusions, even if errors beat a baseline. No guaranteed gains, automatic trading or invented allocation weights.

## Value sourcing
| Value | Source |
| --- | --- |
| Horizon | Fixed 21, 63, 126 recorded sessions, approximate calendar labels |
| Price and cutoff | Validated existing daily snapshot and its hashes |
| Prediction | Separate frozen RNN and saved training scaler for that horizon |
| Quality | Untouched chronological test plus nonoverlapping subset, recorded sample count and baseline comparisons |
| Business facts | Curated paraphrases of verified official FPT publications dated no later than current date |
| Outlook prose | OpenAI using Neo4j retrieved horizon forecasts, quality caveats, dated company evidence and user timeframe |
| Currency and budget | Existing deterministic calculator, invoked only for explicit requests |

## Module contract
`models/outlook/` owns core windows, tests, training/inference pipeline and immutable artifacts. Runtime under ignored `models/daily/runtime/outlook/`. Public snapshot at `website/public/data/fpt-outlook.json`. `outlook.pipeline.read_latest()` returns snapshot; `refresh(frame, source)` runs saved models on a validated daily frame. CLI training can reuse an existing snapshot. No HTTP endpoint trains.

Payload: schema_version=1, symbol, run_id, observed_through, last_close, generated_at, source, horizons. Each horizon: months, sessions, label, predicted_close, predicted_return_pct, direction, target_date=null, test (rnn/persistence/train_mean_return metrics), non_overlapping (count, rnn_mae, persistence_mae, direction_accuracy), test_period, lookback, hidden_size, best_epoch, epochs_run, support (status experimental, beats_persistence, non_overlapping_count, reason). Checkpoints, per origin predictions, source hashes, split metadata, config and training code snapshots are archived.

Daily API gains GET /api/fpt/outlook. A mismatched or unavailable outlook is explicitly unavailable, never silently attached to a newer price. Chat includes the same compatible outlook and versioned company sources before graph retrieval; forecasts and corporate reports are linked to FPT with source provenance. No new credential required.

## Build plan
- [x] Train and evaluate the three horizons with causal tests and immutable evidence.
- [x] Add curated dated company documents and Neo4j retrieval relationships.
- [x] Integrate consumer chat assessments and compact horizon display.
- [x] Verify API, live chat, tests, build, packaging, restart local services.

## Rationale
Direct horizon targets align training with the question. Recursive daily forecasts would accumulate errors and provide no evaluated six month skill. Reusing the stack keeps this local classroom project reproducible. Company evidence helps explain business developments but does not turn a weak forecast into a proven strategy.


## Verification

Run `20261007T232052-ad3f98` uses the validated 1,936 close series through 07/10/2026. Checkpoints were selected on validation before inspecting test. All three models underperformed the unchanged price baseline. Test subsets have 13/4/2 periods without overlap, not independent statistical observations. No parameters were changed after these results. Independent reconstruction checked saved RNN predictions and all checkpoint/source hashes. Frozen refresh from bundled artifacts preserved weights and handled bad input without replacing the prior bundle.

42 Python tests passed, with one opt-in graph revision test skipped. The live local Neo4j import and new HorizonForecast/Publication relationships passed. All 42 website logic checks passed, including acceptance of the real public outlook payload and rejection of date/price/history hash mismatches; TypeScript/Vite build and formatting checks passed. Browser rendering was not visually checked because the earlier local browser access restriction remains in effect.

Live OpenAI/API checks covered a six-month question, follow-up about changed conditions, guarantee-of-profit question, and dividend interpretation. An early reply incorrectly treated a dividend approval as completed; general questions now retrieve relevant business/risk documents, with corporate-action evidence included for explicit dividend/issuance questions. Final six-month reply used H6 and dated B sources, reported weak test support without MAE, and favored watching before committing on that forecast. Explicit dividend question distinguished nominal dividend percentage from return on purchase cost. Future model wording is not guaranteed by these sample checks.

Company evidence is curated as of 07/10/2026. It is not an automatic news crawler. Report chapter source dates are the official IR listing update date where no separate chapter publication timestamp is available.
