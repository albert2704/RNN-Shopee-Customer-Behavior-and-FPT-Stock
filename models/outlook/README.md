# FPT outlook models

Three separate one layer PyTorch RNNs estimate the price change over 21, 63 and
126 recorded sessions, labelled approximately one, three and six months. Each
reads 60 daily log returns and predicts `log(Close[t+h] / Close[t])` directly.
The next session model is not compounded or retrained by this package.

From `models/`, using the existing Python environment:

```sh
.venv/bin/python -m outlook.pipeline train --snapshot daily/runtime/snapshots/81b1ff5ba6d514957338
.venv/bin/python -m unittest outlook.test_outlook -v
```

For a fresh checkout, run `python -m daily.pipeline fetch` first and use the
validated snapshot path printed by that command. The example path above is local
to the recorded training run.

Training uses the existing fixed seed 42, hidden size 32 and Adam/early stopping
configuration. All three checkpoints are selected by validation before test is
evaluated. Origin regions use 70/15/15 boundaries shared across horizons. A
training target must precede the first validation origin; a validation target
must precede the first test origin. Feature and target scalers use training only.

For the 1,936 close snapshot through 2026-10-07, the split counts are:

| Sessions | Train | Validation | Test | Test periods without overlap |
| --- | ---: | ---: | ---: | ---: |
| 21 | 1,292 | 260 | 261 | 13 |
| 63 | 1,250 | 218 | 219 | 4 |
| 126 | 1,187 | 155 | 156 | 2 |

The subset starts at the first test origin and advances exactly the horizon
length. It is fixed before seeing scores. Disjoint return periods are not
necessarily statistically independent; two six month periods provide very
little evidence. All results remain experimental, even when price MAE beats
the unchanged price baseline. Also report the training mean horizon return
baseline on exactly the same origins. Price error and direction accuracy do
not establish profitability or provide a probability/confidence interval.

`read_latest()` reads the complete runtime snapshot with a public file fallback.
`refresh(frame, source)` validates the daily source and input hash, loads all
three frozen checkpoints, and atomically replaces each complete JSON snapshot.
No refresh trains a model. Source changes, older cutoffs, checkpoint corruption
and incomplete bundles fail rather than silently substituting a forecast.

Runtime runs and downloaded datasets stay under ignored
`models/daily/runtime/outlook/`. Shared artifacts in `outlook/artifacts/<run>/`
contain checkpoint files, manifests, source metadata, code snapshots and per
origin validation/test prediction CSVs. They exclude raw market downloads.
The consumer snapshot is `website/public/data/fpt-outlook.json`.

The KBS/Vnstock source has unconfirmed corporate action adjustment. Do not mix
it with the older Kaggle series or describe these forecasts as adjusted total
investment returns. Session counts do not imply exact future calendar dates.
