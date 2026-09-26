# FPT daily forecasts

**Date**: 2026-10-07
**Status**: Accepted

## Summary
Download FPT daily closes, train a reproducible RNN experiment, and show forecasts for the next recorded trading session. Keep the existing classroom replay intact. This implements the daily workflow approved in chat.

## Requirements
- AC-1: Fetch actual historical data through a versioned Vnstock provider, validate sorted unique positive closes, record source, units, adjustment caveat, retrieval time and hash.
- AC-2: Use 30 log returns, chronological 70/15/15 target splits and scalers fitted only on training observations. Select checkpoint on validation, report untouched test price and direction metrics and baselines.
- AC-3: Save a separate immutable run with dataset hash, config, source snapshots, predictions and checkpoint. Never overwrite historical FPT or Shopee artifacts.
- AC-4: A local Python API reads saved results and can refresh data and produce a forecast using the frozen model. No training inside HTTP requests. Validate latest completed session using Vietnam time, exclude current date before a conservative end of day cutoff, and state that source finality still depends on the provider.
- AC-5: A separate Vietnamese website view shows last observed date and close, next session forecast, implied change, no fabricated confidence, metrics, source and stale/offline states. Opening it pauses the replay.
- AC-6: Forecasts are logged before their targets arrive, resolved only against a later observed close. An old data cutoff is visibly identified. Never call a historical snapshot live.
- AC-7: Existing replay tests and build pass, new model integrity and data validation tests pass. Code and launch instructions enter the source ZIP; raw provider data remains local.

## Decision
Use the existing PyTorch RNN (32 hidden units, seed 42, up to 40 epochs, patience 8) in an isolated `models/daily` pipeline. Test Vnstock first, as selected in chat. Pin the actually working version and provider after the source probe. Use FastAPI and Uvicorn on loopback for the Python model; Vite proxies `/api`. JSON/CSV artifacts suit this single user local demo. No database or background scheduler is needed for a manual refresh.

## Feature design
Snapshots and run artifacts live under ignored `models/daily/runtime/`. Public website JSON is an explicitly dated saved forecast, not a live response. The API result and exported snapshot share a schema. A run manifest stores training and validation ranges, config, provider version, snapshot hash, model hash, source hashes, price and three class direction metrics. A direction is the sign of a predicted log return, not a calibrated probability or long term recommendation.

| Action | Value | Source |
| --- | --- | --- |
| Fetch | OHLCV, trading dates | Explicit pinned provider, requested FPT daily history |
| Normalize | VND close | Provider unit contract, validated positive finite values |
| Train | Inputs and targets | Consecutive closes, 30 past log returns to next return |
| Select | Best epoch | Minimum validation MSE only |
| Evaluate | MAE, RMSE, sign accuracy | Frozen checkpoint on chronological test targets |
| Forecast | Price, change | Last close multiplied by exponential of inverse scaled predicted return |
| Display | Target | Next recorded session after input cutoff, no guessed holiday date |
| Freshness | Age and warning | Vietnam date compared with observed cutoff; 7 calendar days triggers warning |
| Resolve | Actual and absolute error | First later observed session in the same source series |

GET `/api/fpt/daily` returns saved forecast, history, test evidence and freshness. POST `/api/fpt/daily/refresh` fetches, validates and predicts, with one process lock, bounded provider timeout and cooldown. Unavailable data/model produces a clear error and preserves the previous result. Local origin and host restrictions protect refresh. Credentials, if ever needed, stay outside browser and Git.

## Build plan
1. Verify provider, implement snapshot validation and run training (AC-1 to AC-3).
2. Implement forecast, ledger and local API (AC-4, AC-6).
3. Add route and Vietnamese forecast UI, preserving playback state (AC-5).
4. Verify calculations, data failures, API and build, update package and instructions (AC-7).

## Consequences
The first run is experimental even if it underperforms persistence. Data coverage and adjustment treatment must be reported honestly. API access may fail; the dated saved snapshot remains readable. Serving beyond localhost requires a separate deployment design. The chatbot, Neo4j and investment allocations are later work and do not enter this slice.

## References
- https://www.vnstocks.com/docs/vnstock/du-lieu-thi-truong-market-data
- Existing `models/src/training.py`, `models/src/models.py`, `models/src/preprocessing.py`.

## Verification, 2026-10-07
Fetched through KBS using Vnstock 4.0.9 with explicit count and provider. Community history is limited to eight years, so request the beginning of the year seven years ago. Pinned prices are thousand VND. The first snapshot contains 1,935 completed sessions through 2026-10-06; the current session was excluded. Model ran 18 epochs, best 10. Independent NumPy recurrence, all validation/test metrics and provenance hashes passed. Test MAE is 1,184.56 VND versus persistence 1,174.18 VND, displayed honestly. Local API GET, real source POST refresh, bundled bootstrap, unit cases and original replay checks passed. TypeScript/Vite build passed. Browser layout was not visually inspected because the previous browser policy blocks localhost access.
