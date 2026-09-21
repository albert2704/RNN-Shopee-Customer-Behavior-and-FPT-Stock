"""Làm sạch, tạo đặc trưng, chia thời gian và chuẩn hóa trên train.

root được truyền tường minh: module không tự quyết định thư mục dữ liệu.
"""

import numpy as np
import pandas as pd
from io_utils import sha256


def prepare_retailrocket(*, root):
    """Gom số hành vi của toàn hệ thống theo giờ, không phân loại từng khách.

    Đếm dòng sự kiện transaction; không mặc định đó là doanh thu/đơn hàng.
    Ba cột đếm dùng log1p để giảm độ lệch và vẫn nhận giá trị 0.
    """
    source = root / "data/raw/events.csv"
    events = pd.read_csv(source)
    raw_rows = len(events)
    duplicates = int(events.duplicated().sum())
    missing = {str(k): int(v) for k, v in events.isna().sum().items()}
    descending = int((events.timestamp.diff() < 0).sum())
    original_event_counts = {
        str(k): int(v) for k, v in events.event.value_counts().items()
    }
    # Chỉ bỏ dòng trùng mọi cột; vẫn giữ hành vi lặp khác bản ghi.
    events = events.drop_duplicates().copy()
    assert not events.timestamp.isna().any()
    assert set(events.event.unique()) == {"view", "addtocart", "transaction"}
    events["time"] = pd.to_datetime(events.timestamp, unit="ms", utc=True)
    first, last = events.time.min(), events.time.max()
    start = first.normalize() + pd.Timedelta(days=1)
    stop = last.normalize()  # cận phải loại trừ; bỏ ngày UTC cuối chưa đủ
    events = events[(events.time >= start) & (events.time < stop)]
    hours = pd.date_range(start, stop, freq="h", inclusive="left")
    observed = (
        events.groupby([events.time.dt.floor("h"), "event"])
        .size()
        .unstack(fill_value=0)
    )
    frame = observed.reindex(hours, fill_value=0)[
        ["view", "addtocart", "transaction"]
    ].copy()
    frame.index.name = "timestamp"
    frame["target"] = frame.transaction.astype(float)
    for column in ["view", "addtocart", "transaction"]:
        frame["log_" + column] = np.log1p(frame[column].astype(float))
    # Cặp sin/cos nối 23h với 0h và Chủ nhật với thứ Hai theo chu kỳ.
    for prefix, values, period in [
        ("hour", frame.index.hour, 24),
        ("weekday", frame.index.dayofweek, 7),
    ]:
        frame[prefix + "_sin"] = np.sin(2 * np.pi * values / period)
        frame[prefix + "_cos"] = np.cos(2 * np.pi * values / period)
    frame["model_target"] = frame.log_transaction
    features = [
        "log_view",
        "log_addtocart",
        "log_transaction",
        "hour_sin",
        "hour_cos",
        "weekday_sin",
        "weekday_cos",
    ]
    audit = dict(
        source_file="data/raw/events.csv",
        source_sha256=sha256(source),
        source_url="https://www.kaggle.com/datasets/retailrocket/ecommerce-dataset",
        raw_rows=raw_rows,
        missing_by_column=missing,
        duplicate_rows=duplicates,
        duplicate_decision="Remove exact full-row duplicates only. Simultaneous genuine identical actions cannot be distinguished; this is an explicit cleaning assumption.",
        raw_event_counts=original_event_counts,
        raw_distinct_visitors=int(
            pd.read_csv(source, usecols=["visitorid"]).visitorid.nunique()
        ),
        descending_adjacent_timestamp_pairs=descending,
        raw_first_timestamp=first.isoformat(),
        raw_last_timestamp=last.isoformat(),
        first_timestamp=frame.index[0].isoformat(),
        last_timestamp=frame.index[-1].isoformat(),
        clean_event_rows=len(events),
        excluded_boundary_event_rows=raw_rows - duplicates - len(events),
        series_rows=len(frame),
        interval="1 hour, UTC",
        source_was_sorted=descending == 0,
        empty_observation_hours=int(
            (frame[["view", "addtocart", "transaction"]].sum(axis=1) == 0).sum()
        ),
        zero_target_hours=int((frame.target == 0).sum()),
        event_counts_after_cleaning={
            k: int(frame[k].sum()) for k in ["view", "addtocart", "transaction"]
        },
        target_mean=float(frame.target.mean()),
        target_std=float(frame.target.std()),
        target_min=float(frame.target.min()),
        target_max=float(frame.target.max()),
        target_quantiles={
            str(k): float(v)
            for k, v in frame.target.quantile([0, 0.25, 0.5, 0.75, 0.95, 1]).items()
        },
        boundary_policy="Discard first and last partial UTC calendar days; aggregate retained events by hour and sort the hourly index.",
        zero_assumption="An hour/event type absent from the log is encoded as zero observed events. Logging outages cannot be separated from genuine inactivity; zero does not prove zero latent customer demand.",
        missing_decision="Missing transactionid on non-transaction events is structurally expected; transactionid is not an input. No numeric interpolation or future filling.",
        outlier_decision="Retain all observed counts; log1p reduces skew without clipping observed targets.",
        behavior_meaning="Aggregate view/add-to-cart/transaction activity over time; not individual-user classification. Transactions are event rows, not guaranteed unique orders or revenue.",
    )
    return frame, features, 24, audit


def prepare_amazon(*, root):
    """Giá nguồn Adj Close -> log return giữa hai phiên liên tiếp.

    Không thêm giá giả vào cuối tuần/ngày nghỉ. Adj Close điều chỉnh hồi tố
    nên kết quả là bài thực hành lịch sử, không phải backtest giao dịch.
    """
    source = root / "data/raw/AMZN.csv"
    raw = pd.read_csv(source)
    missing = {str(k): int(v) for k, v in raw.isna().sum().items()}
    raw_rows, duplicates = len(raw), int(raw.duplicated().sum())
    cleaned = raw.drop_duplicates().copy()
    cleaned["timestamp"] = pd.to_datetime(cleaned.Date, utc=True)
    cleaned = cleaned.sort_values("timestamp")
    assert (
        not cleaned.timestamp.duplicated().any()
    ), "Conflicting daily records require manual resolution"
    assert not cleaned[["timestamp", "Adj Close"]].isna().any().any()
    assert (cleaned["Adj Close"] > 0).all()
    frame = cleaned.set_index("timestamp")[
        ["Open", "High", "Low", "Close", "Adj Close", "Volume"]
    ].copy()
    frame["target"] = frame["Adj Close"]
    frame["log_return"] = np.log(frame.target / frame.target.shift(1))
    # Phiên đầu không có giá phiên trước để tính return, nên bỏ đúng hàng đó.
    frame = frame.iloc[1:].copy()
    frame["model_target"] = frame.log_return
    audit = dict(
        source_file="data/raw/AMZN.csv",
        source_sha256=sha256(source),
        source_url="https://www.kaggle.com/datasets/henryshan/amazon-com-inc-amzn",
        raw_rows=raw_rows,
        missing_by_column=missing,
        duplicate_rows=duplicates,
        duplicate_decision="Remove exact duplicate rows; reject conflicting dates.",
        clean_rows=len(cleaned),
        raw_first_timestamp=cleaned.timestamp.min().isoformat(),
        raw_last_timestamp=cleaned.timestamp.max().isoformat(),
        first_timestamp=frame.index[0].isoformat(),
        last_timestamp=frame.index[-1].isoformat(),
        series_rows=len(frame),
        interval="Next recorded trading session; weekends and exchange holidays are not interpolated",
        first_return_row_removed=1,
        target_mean=float(frame.target.mean()),
        target_std=float(frame.target.std()),
        target_min=float(frame.target.min()),
        target_max=float(frame.target.max()),
        target_quantiles={
            str(k): float(v)
            for k, v in frame.target.quantile([0, 0.25, 0.5, 0.75, 0.95, 1]).items()
        },
        log_return_mean=float(frame.log_return.mean()),
        log_return_std=float(frame.log_return.std()),
        missing_decision="No missing stock fields; no interpolation or resampling to non-trading dates.",
        outlier_decision="Retain all sessions and large returns; no target clipping or winsorization.",
        adjustment_caveat="Use source-provided retrospective Adj Close. Source adjustment factors may incorporate corporate actions that became known later; this is a historical educational benchmark, not a point-in-time trading backtest.",
        price_unit="USD per source-adjusted share",
    )
    return frame, ["log_return"], 30, audit


def prepare_data(name, *, root):
    """Chia theo thời điểm đích; cửa sổ dự báo t chỉ chứa [t-L, t).

    X có dạng (N, L, F), y có dạng (N, 1). Đích t không nằm trong X.
    L=24/F=7 với Retailrocket; L=30/F=1 với Amazon.
    """
    frame, features, lookback, audit = (
        prepare_retailrocket(root=root)
        if name == "retailrocket"
        else prepare_amazon(root=root)
    )
    targets = np.arange(lookback, len(frame), dtype=np.int64)
    # Chia 70/15/15 theo thời gian đích, không xáo trộn trước khi chia.
    train_count, val_count = int(0.70 * len(targets)), int(0.15 * len(targets))
    indices = dict(
        train=targets[:train_count],
        validation=targets[train_count : train_count + val_count],
        test=targets[train_count + val_count :],
    )
    train_end = int(indices["train"][-1])
    feature_values = frame[features].to_numpy(dtype=np.float64)
    target_values = frame.model_target.to_numpy(dtype=np.float64)
    # Chỉ fit thống kê trong đoạn train (kể cả lịch sử nhìn lại có sẵn).
    # Hàng train_end thuộc train; tuyệt đối không fit trên validation/test.
    # x[t-L:t] vẫn loại hàng t ở mọi mẫu, kể cả mẫu cuối của train.
    x_mean = feature_values[: train_end + 1].mean(axis=0)
    x_scale = feature_values[: train_end + 1].std(axis=0)
    x_scale[x_scale == 0] = 1.0
    # Scaler của y chỉ dùng các nhãn train, không dùng toàn bộ chuỗi.
    y_mean = float(target_values[indices["train"]].mean())
    y_scale = float(target_values[indices["train"]].std()) or 1.0
    # float32 khớp dtype mặc định của các trọng số PyTorch.
    scaled_x = ((feature_values - x_mean) / x_scale).astype(np.float32)
    scaled_y = ((target_values - y_mean) / y_scale).astype(np.float32)
    arrays, splits = {}, {}
    for split, ids in indices.items():
        # Slice Python bỏ cận phải t: giữ đúng L hàng từ t-L đến t-1.
        arrays["x_" + split] = np.stack([scaled_x[t - lookback : t] for t in ids])
        arrays["y_" + split] = scaled_y[ids, None]
        arrays["index_" + split] = ids
        splits[split] = dict(
            n=len(ids),
            first_timestamp=frame.index[ids[0]].isoformat(),
            last_timestamp=frame.index[ids[-1]].isoformat(),
            first_target_index=int(ids[0]),
            last_target_index=int(ids[-1]),
        )
    folder = root / "data/processed"
    folder.mkdir(parents=True, exist_ok=True)
    frame.to_csv(folder / f"{name}.csv", index=True)
    np.savez_compressed(folder / f"{name}_windows.npz", **arrays)
    meta = dict(
        name=name,
        audit=audit,
        features=features,
        lookback=lookback,
        splits=splits,
        normalization=dict(
            x_mean=x_mean.tolist(),
            x_scale=x_scale.tolist(),
            y_mean=y_mean,
            y_scale=y_scale,
            fit_first_timestamp=frame.index[0].isoformat(),
            fit_last_timestamp=frame.index[train_end].isoformat(),
            feature_fit_rows=train_end + 1,
            target_fit_rows=len(indices["train"]),
            x_method="Per-feature population mean/std fitted to training timestamps only, including available lookback context.",
            y_method="Population mean/std of transformed training targets only.",
        ),
        prediction_task=(
            "Next-hour observed transaction-event count"
            if name == "retailrocket"
            else "Next-trading-session adjusted closing price"
        ),
        target_transform=(
            "log1p(count)"
            if name == "retailrocket"
            else "log(AdjClose_t / AdjClose_t-1)"
        ),
        inverse_transform=(
            "max(0, expm1(predicted transformed target))"
            if name == "retailrocket"
            else "AdjClose_t-1 * exp(predicted log return)"
        ),
        target_unit=(
            "transaction events per hour"
            if name == "retailrocket"
            else "USD per source-adjusted share"
        ),
        evaluation_policy="Chronological 70/15/15 split of eligible target indices. One-step rolling forecasts use observed history, including earlier validation/test observations. Hidden state is reset for each independent window. This is not recursive or multi-step forecasting.",
        transform_caveat=(
            "MSE on log1p counts learns a transformed-space conditional mean; expm1 does not generally equal the arithmetic conditional mean of counts."
            if name == "retailrocket"
            else "MSE on log returns differs from dollar-price MSE; return errors are amplified when reconstructed at high price levels."
        ),
        prepared_series_file=f"data/processed/{name}.csv",
        prepared_windows_file=f"data/processed/{name}_windows.npz",
    )
    assert (
        indices["train"][-1]
        < indices["validation"][0]
        <= indices["validation"][-1]
        < indices["test"][0]
    )
    assert all((ids - lookback >= 0).all() for ids in indices.values())
    assert all(
        np.isfinite(array).all()
        for key, array in arrays.items()
        if key.startswith(("x_", "y_"))
    )
    return frame, arrays, meta
