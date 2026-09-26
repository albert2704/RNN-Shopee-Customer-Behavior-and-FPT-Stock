"""Suy luận, đổi về đơn vị gốc và so sánh công bằng với baseline."""

import numpy as np
import pandas as pd
import torch


@torch.no_grad()
def predict(model, x):
    """Dự báo CPU theo lô 256, trả vector NumPy (N,).

    eval() chuyển chế độ lớp; no_grad() tắt ghi đồ thị gradient.
    Đây là hai việc khác nhau. Không có backward hay cập nhật trọng số.
    """
    model.eval()
    pieces = [
        model(torch.from_numpy(x[first : first + 256])).numpy().reshape(-1)
        for first in range(0, len(x), 256)
    ]
    return np.concatenate(pieces)


def original_units(name, scaled_predictions, meta, previous):
    """Bỏ chuẩn hóa rồi đảo biến đổi để chấm điểm ở đơn vị gốc.

    Shopee Thailand: expm1(log_order_count), chặn dự báo âm tại 0.
    FPT: giá thực tại t-1 nhân exp(log_return dự báo).
    Hàm này dành cho hai bộ dữ liệu A6: Shopee Thailand và FPT.
    """
    transformed = (
        np.asarray(scaled_predictions, dtype=np.float64)
        * meta["normalization"]["y_scale"]
        + meta["normalization"]["y_mean"]
    )
    if name == "shopee":
        return np.maximum(0.0, np.expm1(transformed))
    return previous * np.exp(transformed)


def metrics(actual, predicted):
    """MAE/RMSE cùng đơn vị với y; RMSE phạt sai số lớn mạnh hơn."""
    errors = np.asarray(predicted, dtype=np.float64) - np.asarray(
        actual, dtype=np.float64
    )
    assert np.isfinite(errors).all()
    return dict(
        MAE=float(np.abs(errors).mean()), RMSE=float(np.sqrt(np.square(errors).mean()))
    )


def evaluate(name, frame, arrays, meta, *, root, fit_model):
    """So sánh RNN, GRU và baseline trên chính cùng các thời điểm đích.

    fit_model là hàm được facade truyền vào, đã gắn đúng ROOT/CONFIG.
    """
    models = {}
    for kind in ["rnn", "gru"]:
        model, result = fit_model(name, kind, arrays, meta)
        rows, result["metrics"], result["transformed_MSE"] = [], {}, {}
        for split in ["validation", "test"]:
            ids = arrays["index_" + split]
            previous = frame.target.to_numpy()[ids - 1]
            actual = frame.target.to_numpy()[ids]
            # Chỉ dự báo test sau khi đã cố định checkpoint chọn bằng validation.
            scaled_pred = predict(model, arrays["x_" + split])
            predicted = original_units(name, scaled_pred, meta, previous)
            result["metrics"][split] = metrics(actual, predicted)
            result["transformed_MSE"][split] = float(
                np.square(scaled_pred - arrays["y_" + split].reshape(-1)).mean()
            )
            rows.append(
                pd.DataFrame(
                    dict(
                        split=split,
                        timestamp=frame.index[ids],
                        actual=actual,
                        predicted=predicted,
                        previous=previous,
                        target_index=ids,
                    )
                )
            )
        path = root / "results" / name / f"{kind}_predictions.csv"
        pd.concat(rows, ignore_index=True).to_csv(path, index=False)
        result["predictions_file"] = str(path.relative_to(root))
        models[kind] = result
    # Baseline là quy tắc đơn giản để biết mô hình có thực sự thêm giá trị.
    # Chúng dùng lịch sử quan sát; không fit lại bằng nhãn test.
    baseline_names = (
        ["persistence", "seasonal"]
        if name == "shopee"
        else ["persistence", "train_mean"]
    )
    for kind in baseline_names:
        rows, result = [], dict(metrics={})
        for split in ["validation", "test"]:
            ids = arrays["index_" + split]
            previous, actual = (
                frame.target.to_numpy()[ids - 1],
                frame.target.to_numpy()[ids],
            )
            if kind == "seasonal":
                assert (ids >= 7).all()
                predicted = frame.target.to_numpy()[ids - 7]
            elif kind == "train_mean":
                predicted = previous * np.exp(meta["normalization"]["y_mean"])
            else:
                predicted = previous.copy()
            result["metrics"][split] = metrics(actual, predicted)
            rows.append(
                pd.DataFrame(
                    dict(
                        split=split,
                        timestamp=frame.index[ids],
                        actual=actual,
                        predicted=predicted,
                        previous=previous,
                        target_index=ids,
                    )
                )
            )
        path = root / "results" / name / f"{kind}_predictions.csv"
        pd.concat(rows, ignore_index=True).to_csv(path, index=False)
        result["predictions_file"] = str(path.relative_to(root))
        result["definition"] = {
            "persistence": "Previous observed target value",
            "seasonal": "Observed order count on the same weekday 7 days earlier",
            "train_mean": "Previous source Close multiplied by exp(mean training log return)",
        }[kind]
        models[kind] = result
    return models
