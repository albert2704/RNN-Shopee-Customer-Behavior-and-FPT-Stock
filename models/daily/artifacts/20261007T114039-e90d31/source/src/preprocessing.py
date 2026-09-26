"""Làm sạch, tạo đặc trưng, chia thời gian và chuẩn hóa trên train.

root được truyền tường minh: module không tự quyết định thư mục dữ liệu.
"""

import numpy as np
import pandas as pd
from io_utils import sha256


def prepare_shopee(*, root):
    """Gom hành vi mô phỏng theo ngày nguồn rồi dự báo số đơn ngày sau.

    Page URL là lượt thăm trang, không phải sự kiện thêm sản phẩm vào giỏ.
    Mỗi đầu vào chỉ dùng các quan sát của ngày đã kết thúc trước ngày đích.
    """
    filenames = {
        "orders": "shopee_orders_thailand.csv",
        "sessions": "shopee_website_sessions_thailand.csv",
        "activities": "shopee_session_activities_thailand.csv",
    }
    sources = {key: root / "data/raw" / name for key, name in filenames.items()}
    orders = pd.read_csv(sources["orders"])
    sessions = pd.read_csv(sources["sessions"])
    activities = pd.read_csv(sources["activities"])
    tables = {"orders": orders, "sessions": sessions, "activities": activities}
    required = {
        "orders": ["order_id", "order_date"],
        "sessions": ["session_id", "session_date", "session_start_time", "session_end_time"],
        "activities": ["activity_id", "session_id", "page_url", "session_start_time", "session_end_time"],
    }
    for key, table in tables.items():
        assert set(required[key]).issubset(table.columns)
        assert not table[required[key]].isna().any().any()
        assert not table[required[key][0]].duplicated().any(), f"Repeated {key} IDs require resolution"
    orders["time"] = pd.to_datetime(orders.order_date, utc=True, errors="raise")
    sessions["time"] = pd.to_datetime(sessions.session_start_time, utc=True, errors="raise")
    activities["time"] = pd.to_datetime(activities.session_start_time, utc=True, errors="raise")
    session_end = pd.to_datetime(sessions.session_end_time, utc=True, errors="raise")
    activity_end = pd.to_datetime(activities.session_end_time, utc=True, errors="raise")
    assert (session_end >= sessions.time).all()
    assert (activity_end >= activities.time).all()
    assert sessions.time.dt.normalize().eq(pd.to_datetime(sessions.session_date, utc=True)).all()
    assert activities.session_id.isin(sessions.session_id).all()
    linked = sessions[sessions.order_id.notna()].merge(
        orders[["order_id", "order_date"]], on="order_id", how="left", validate="many_to_one"
    )
    assert linked.order_date.notna().all()
    assert linked.order_date.eq(linked.session_date).all()
    assert linked.order_id.is_unique
    bounds = activities[["session_id", "time"]].merge(
        pd.DataFrame({"session_id": sessions.session_id, "start": sessions.time, "end": session_end}),
        on="session_id", validate="many_to_one"
    )
    assert bounds.time.ge(bounds.start).all() and bounds.time.le(bounds.end).all()
    # Full source calendar days 2022–2025. Activity starts on 2026-01-01
    # belong to a session crossing midnight, but there is no complete target day.
    start, stop = pd.Timestamp("2022-01-01", tz="UTC"), pd.Timestamp("2026-01-01", tz="UTC")
    days = pd.date_range(start, stop, freq="D", inclusive="left")
    frame = pd.DataFrame(index=days)
    def daily_count(table, mask=None):
        times = table.time if mask is None else table.loc[mask, "time"]
        times = times[(times >= start) & (times < stop)]
        return times.dt.normalize().value_counts().reindex(days, fill_value=0).sort_index().astype(int)
    frame["sessions"] = daily_count(sessions)
    for column, page in [("product_visits", "/products"), ("cart_visits", "/cart"), ("checkout_visits", "/checkout")]:
        frame[column] = daily_count(activities, activities.page_url.eq(page))
    frame["orders"] = daily_count(orders)
    frame.index.name = "timestamp"
    frame["target"] = frame.orders.astype(float)
    columns = ["sessions", "product_visits", "cart_visits", "checkout_visits", "orders"]
    for column in columns:
        frame["log_" + column] = np.log1p(frame[column].astype(float))
    frame["model_target"] = frame.log_orders
    audit = dict(
        source_file="data/raw/" + filenames["orders"],
        source_sha256=sha256(sources["orders"]),
        source_files={"data/raw/" + filenames[key]: sha256(path) for key, path in sources.items()},
        source_url="https://www.kaggle.com/datasets/hninshwezinhlaing/shopee-th-customer-journey-and-operations-dataset",
        synthetic=True, source_version=1, license="CC BY-SA 4.0",
        raw_rows=len(orders), raw_session_rows=len(sessions), raw_activity_rows=len(activities),
        raw_rows_by_table={key: len(table) for key, table in tables.items()},
        missing_by_table={key: {str(k): int(v) for k, v in table.isna().sum().items() if k != "time"} for key, table in tables.items()},
        duplicate_rows_by_table={key: int(table.duplicated().sum()) for key, table in tables.items()},
        unique_order_ids=int(orders.order_id.nunique()), unique_session_ids=int(sessions.session_id.nunique()),
        activity_page_counts={str(k): int(v) for k, v in activities.page_url.value_counts().items()},
        linked_order_sessions=len(linked), orphan_activity_rows=0, orphan_linked_orders=0,
        linked_order_session_date_conflicts=0,
        excluded_activity_rows=int(((activities.time < start) | (activities.time >= stop)).sum()),
        first_timestamp=frame.index[0].isoformat(), last_timestamp=frame.index[-1].isoformat(),
        raw_first_timestamp=orders.time.min().isoformat(), raw_last_timestamp=orders.time.max().isoformat(),
        series_rows=len(frame), interval="1 source calendar day; timezone not specified by publisher",
        zero_target_days=int(frame.orders.eq(0).sum()),
        aggregate_counts={column: int(frame[column].sum()) for column in columns},
        target_mean=float(frame.target.mean()), target_std=float(frame.target.std()),
        target_min=float(frame.target.min()), target_max=float(frame.target.max()),
        target_quantiles={str(k): float(v) for k, v in frame.target.quantile([0, .25, .5, .75, .95, 1]).items()},
        boundary_policy="Use complete declared 2022–2025 source calendar days. Discard page starts on 2026-01-01 because there is no complete corresponding target day. Preserve source clock labels; UTC is a storage convention, not an inferred timezone.",
        zero_assumption="Missing order days mean zero observed generated orders, not proven zero real demand. Sessions cover every retained day.",
        missing_decision="Required identifiers and timestamps must be complete. Blank marketing/campaign/order links on nonpurchasing sessions are expected and not model inputs. No interpolation or future filling.",
        outlier_decision="Retain all generated daily counts; log1p reduces skew without clipping targets.",
        behavior_meaning="Population-level daily session starts and page visits plus unique order count. Cart-page visits do not prove add-to-cart actions. Not individual purchase prediction.",
        synthetic_caveat="100% synthetic Shopee Thailand simulation from an independent publisher, not official Shopee records and not Vietnamese customer data. Evaluation only describes generated patterns.",
    )
    return frame, ["log_" + column for column in columns], 30, audit


def prepare_fpt(*, root):
    """FPT Close (VND) -> log return giữa hai phiên đã ghi nhận.

    TradingDate dùng ngày/tháng/năm. Không nội suy ngày nghỉ và không tự
    tạo Adj Close: nguồn chỉ có Close, không mô tả điều chỉnh doanh nghiệp.
    """
    source = root / "data/raw/FPT.csv"
    raw = pd.read_csv(source)
    required = ["Symbol", "TradingDate", "Open", "High", "Low", "Close", "Volume"]
    assert set(required).issubset(raw.columns), "Missing required FPT columns"
    missing = {str(k): int(v) for k, v in raw.isna().sum().items()}
    raw_rows, duplicates = len(raw), int(raw.duplicated().sum())
    cleaned = raw.drop_duplicates().copy()
    assert cleaned.Symbol.eq("FPT").all(), "Expected only FPT records"
    cleaned["timestamp"] = pd.to_datetime(
        cleaned.TradingDate, format="%d/%m/%Y", utc=True, errors="raise"
    )
    cleaned = cleaned.sort_values("timestamp")
    # Value is not an input: identical date/OHLCV records may differ only there.
    before_daily_dedup = len(cleaned)
    cleaned = cleaned.drop_duplicates(subset=["Symbol", "timestamp", "Open", "High", "Low", "Close", "Volume"]).copy()
    redundant_daily_rows = before_daily_dedup - len(cleaned)
    assert not cleaned.timestamp.duplicated().any(), "Conflicting daily prices/volumes require manual resolution"
    for column in ["Open", "High", "Low", "Close", "Volume"]:
        cleaned[column] = pd.to_numeric(cleaned[column], errors="raise")
    assert not cleaned[required + ["timestamp"]].isna().any().any()
    assert np.isfinite(cleaned[["Open", "High", "Low", "Close", "Volume"]]).all().all()
    assert (cleaned.Close > 0).all(), "Close must be positive for log returns"
    assert (cleaned[["Open", "High", "Low"]] >= 0).all().all()
    assert (cleaned.Volume >= 0).all()
    # Only Close is modeled. Record anomalies in unused OHLC fields, do not
    # silently repair prices or drop valid positive closing observations.
    inconsistent_ohlc = ((cleaned.High < cleaned[["Open", "Close", "Low"]].max(axis=1)) | (cleaned.Low > cleaned[["Open", "Close", "High"]].min(axis=1)))
    frame = cleaned.set_index("timestamp")[["Open", "High", "Low", "Close", "Volume"]].copy()
    frame["target"] = frame.Close.astype(float)
    frame["log_return"] = np.log(frame.target / frame.target.shift(1))
    frame = frame.iloc[1:].copy()  # Phiên đầu chưa có giá trước để tính return.
    frame["model_target"] = frame.log_return
    audit = dict(
        source_file="data/raw/FPT.csv",
        source_sha256=sha256(source),
        source_url="https://www.kaggle.com/datasets/thangtranquang/stock-vn30-vietnam",
        raw_rows=raw_rows,
        missing_by_column=missing,
        duplicate_rows=duplicates,
        duplicate_decision="Remove exact full-row duplicates, then identical Symbol/date/OHLCV rows differing only in unused Value/Time. Reject conflicting daily prices/volumes.",
        redundant_daily_rows=redundant_daily_rows,
        zero_volume_rows=int(cleaned.Volume.eq(0).sum()),
        inconsistent_ohlc_rows=int(inconsistent_ohlc.sum()),
        auxiliary_field_decision="Retain positive Close for all recorded dates. Six rows have inconsistent unused OHLC fields, including one zero-volume row with zero Open/High/Low. These fields are not model inputs and are not repaired.",
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
        target_quantiles={str(k): float(v) for k, v in frame.target.quantile([0, .25, .5, .75, .95, 1]).items()},
        log_return_mean=float(frame.log_return.mean()),
        log_return_std=float(frame.log_return.std()),
        missing_decision="Time is empty in every daily record and is not used. Required date/OHLCV fields must be complete. No interpolation or future filling.",
        outlier_decision="Retain all recorded sessions and large returns; no clipping or corporate-action correction invented.",
        adjustment_caveat="Source provides Close only, not Adj Close, and does not document adjustment methodology. Retain Close as supplied; jumps may include corporate actions. This is a historical educational benchmark.",
        price_column="Close",
        price_unit="VND per share, source Close as supplied",
    )
    return frame, ["log_return"], 30, audit


def prepare_data(name, *, root):
    """Chia theo thời điểm đích; cửa sổ dự báo t chỉ chứa [t-L, t).

    X có dạng (N, L, F), y có dạng (N, 1). Đích t không nằm trong X.
    L=30/F=5 với Shopee Thailand; L=30/F=1 với FPT.
    """
    if name not in {"shopee", "fpt"}:
        raise ValueError(f"Unsupported dataset: {name}")
    frame, features, lookback, audit = (
        prepare_shopee(root=root)
        if name == "shopee"
        else prepare_fpt(root=root)
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
            "Next-day observed unique order count in a synthetic Shopee Thailand simulation"
            if name == "shopee"
            else "Next-recorded-trading-session FPT closing price"
        ),
        target_transform=(
            "log1p(count)"
            if name == "shopee"
            else "log(Close_t / Close_t-1)"
        ),
        inverse_transform=(
            "max(0, expm1(predicted transformed target))"
            if name == "shopee"
            else "Close_t-1 * exp(predicted log return)"
        ),
        target_unit=(
            "orders per source calendar day"
            if name == "shopee"
            else "VND per share, source Close as supplied"
        ),
        evaluation_policy="Chronological 70/15/15 split of eligible target indices. One-step rolling forecasts use observed history, including earlier validation/test observations. Hidden state is reset for each independent window. This is not recursive or multi-step forecasting.",
        transform_caveat=(
            "MSE on log1p counts learns a transformed-space conditional mean; expm1 does not generally equal the arithmetic conditional mean of counts."
            if name == "shopee"
            else "MSE on log returns differs from VND-price MSE; return errors are amplified when reconstructed at high price levels."
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
