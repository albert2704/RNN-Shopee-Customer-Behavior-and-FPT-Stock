#!/usr/bin/env python3
"""Xuất hoạt ảnh RNN thật từ checkpoint đã huấn luyện, không huấn luyện lại.

Mỗi tập dùng nhãn test đầu tiên theo thời gian, không chọn mẫu vì dự báo đẹp.
Luồng đọc: load_checkpoint → predict_saved_windows → replay_recurrence
→ export_dataset. Kết quả phải khớp cửa sổ NPZ, CSV dự đoán và chỉ số đã lưu.
"""

from pathlib import Path
import hashlib
import json

import numpy as np
import pandas as pd
import torch
from torch import nn

WEBSITE = Path(__file__).resolve().parents[1]
MODELS = WEBSITE.parent / "models"
DESTINATION = WEBSITE / "public/data/demo.json"

COPY = {
    "shopee": dict(
        title="Shopee Thailand",
        question="Ngày mai có bao nhiêu đơn hàng?",
        unit="đơn", stepUnit="ngày",
        notes=dict(
            input="30 ngày quá khứ. Mỗi ngày có 5 số đếm: lượt truy cập, thăm trang sản phẩm, giỏ hàng, thanh toán và đơn hàng. Dùng log1p rồi chuẩn hóa bằng thống kê train.",
            output="RNN dự đoán log1p của số đơn ngày sau đã chuẩn hóa. Bỏ chuẩn hóa rồi tính max(0, expm1(z × độ lệch chuẩn train + trung bình train)).",
            limitation="100% mô phỏng Shopee Thailand từ một tác giả độc lập. Không phải dữ liệu chính thức hoặc khách hàng Việt Nam. Lượt thăm giỏ không phải hành động thêm giỏ. Dự đoán số đơn có thể là số thập phân; một ngày không đủ kết luận.",
            display="Đường biểu đồ là số đơn mỗi ngày. RNN đọc đủ 5 đặc trưng hành vi của các ngày đã kết thúc, không dùng dữ liệu của ngày đích.",
        ),
        clockNote="Giữ ngày nguồn 2022–2025. Nguồn không ghi múi giờ; UTC trong CSV chỉ là quy ước lưu nhãn ngày. Bỏ lượt thăm bắt đầu vào 01/01/2026 ngoài khoảng mục tiêu đầy đủ.",
    ),
    "fpt": dict(
        title="FPT",
        question="Giá đóng cửa của phiên tiếp theo là bao nhiêu?",
        unit="VND",
        stepUnit="phiên",
        notes=dict(
            input="30 phiên giao dịch, mỗi phiên có 1 log return: ln(P_t / P_(t−1)), chuẩn hóa bằng thống kê tập train. Mạng không nhận trực tiếp giá VND.",
            output="Đổi đầu ra đã chuẩn hóa thành log return dự đoán r̂, rồi tính giá phiên sau: P̂ = giá phiên cuối × exp(r̂).",
            limitation="Nguồn FPT chỉ có Close, không có Adj Close và không mô tả phương pháp điều chỉnh. Biến động có thể bao gồm sự kiện doanh nghiệp. So sánh RNN với giá phiên trước trên toàn bộ test; một ví dụ không đủ kết luận.",
            display="Đường biểu đồ là giá đóng cửa (VND). Đầu vào thật của mạng là log return đã chuẩn hóa.",
        ),
        clockNote="Nhãn ngày của các phiên giao dịch; không thêm ngày nghỉ. UTC trong file xử lý chỉ là cách lưu nhãn ngày, không phải thời điểm đóng cửa sàn.",
    ),
}


class RestoredRNN(nn.Module):
    """Khôi phục đúng tên tham số recurrent.* và output.* của checkpoint."""

    def __init__(self, saved):
        super().__init__()
        assert saved["kind"] == "rnn"
        self.recurrent = nn.RNN(
            saved["input_size"], saved["hidden_size"], batch_first=True
        )
        self.output = nn.Linear(saved["hidden_size"], 1)


def original_units(name, scaled, norm, previous):
    # Giữ đúng dtype/thứ tự phép tính của lần chạy gốc.
    transformed = (
        np.asarray(scaled, dtype=np.float64) * norm["y_scale"] + norm["y_mean"]
    )
    return (
        np.maximum(0.0, np.expm1(transformed))
        if name == "shopee"
        else previous * np.exp(transformed)
    )


def load_checkpoint(checkpoint, expected_hash):
    """Kiểm tra SHA-256 rồi nạp trọng số; eval() chỉ đổi chế độ, không học thêm."""
    checkpoint_hash = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    assert checkpoint_hash == expected_hash
    saved = torch.load(checkpoint, map_location="cpu", weights_only=True)
    model = RestoredRNN(saved)
    model.load_state_dict(saved["state_dict"])
    model.eval()
    return model, saved, checkpoint_hash


def predict_saved_windows(model, windows):
    """Chạy lại cả test bằng batch 256 như phép đánh giá gốc để giữ số học float32."""
    outputs = []
    hidden = None
    # Không tạo đồ thị gradient: đây là suy luận (inference), không phải training.
    with torch.no_grad():
        for start in range(0, len(windows), 256):
            sequence, _ = model.recurrent(
                torch.from_numpy(windows[start : start + 256])
            )
            outputs.append(model.output(sequence[:, -1]).numpy().ravel())
            if start == 0:
                # sequence: (B, L, 32). Lấy đủ L trạng thái của mẫu test đầu tiên.
                hidden = sequence[0].numpy()
    return np.concatenate(outputs), hidden


def replay_recurrence(inputs, state, hidden_size):
    """Tính tay lượt thuận để đối chiếu từng h_t với nn.RNN; trọng số giữ nguyên."""
    previous = torch.zeros(hidden_size)  # h_0 = vector 0 ở đầu cửa sổ độc lập.
    manual = []
    for row in inputs:
        # h_t = tanh(W_x x_t + b_x + W_h h_(t-1) + b_h).
        # PyTorch lưu hai bias; cả hai cùng tham gia phép cộng trước tanh.
        previous = torch.tanh(
            state["recurrent.weight_ih_l0"] @ torch.from_numpy(row)
            + state["recurrent.bias_ih_l0"]
            + state["recurrent.weight_hh_l0"] @ previous
            + state["recurrent.bias_hh_l0"]
        )
        manual.append(previous.numpy())
    return np.stack(manual)


def trace_first_component(inputs, state, hidden):
    """Xuất phép tính thật của phần tử đầu tiên h_t[0] để giải thích trên web.

    RNN vẫn tính đủ 32 hàng của ma trận. Chỉ hàng đầu tiên được tách thành
    từng tích để người xem đọc được phép tính; đây không phải mô hình 1 neuron.
    Trạng thái trước lấy từ chính nn.RNN, không dùng số minh họa tự đặt.
    """
    traces = []
    with torch.no_grad():
        for i, row in enumerate(inputs):
            previous = (
                torch.zeros(hidden.shape[1], dtype=torch.float32)
                if i == 0
                else torch.from_numpy(hidden[i - 1])
            )
            input_terms = state["recurrent.weight_ih_l0"][0] * torch.from_numpy(row)
            previous_terms = state["recurrent.weight_hh_l0"][0] * previous
            bias_input = state["recurrent.bias_ih_l0"][0]
            bias_hidden = state["recurrent.bias_hh_l0"][0]
            # Cộng trong float32 như checkpoint. Khác thứ tự cộng với kernel
            # nn.RNN có thể tạo sai số làm tròn rất nhỏ, nên kiểm tra có dung sai.
            preactivation = (
                input_terms.sum() + bias_input + previous_terms.sum() + bias_hidden
            )
            state_value = torch.tanh(preactivation)
            np.testing.assert_allclose(
                state_value.item(), hidden[i, 0], rtol=1e-5, atol=1e-6
            )
            np.testing.assert_allclose(
                sum(input_terms.tolist())
                + bias_input.item()
                + sum(previous_terms.tolist())
                + bias_hidden.item(),
                preactivation.item(),
                rtol=1e-5,
                atol=1e-6,
            )
            traces.append(
                dict(
                    inputTerms=input_terms.tolist(),
                    previousTerms=previous_terms.tolist(),
                    biasInput=bias_input.item(),
                    biasHidden=bias_hidden.item(),
                    preactivation=preactivation.item(),
                    stateValue=state_value.item(),
                )
            )
    return traces


def export_dataset(name):
    """Đọc một tập, xác minh tính nhân quả và đóng gói dữ liệu đúng schema DemoDataset."""
    if name not in COPY:
        raise ValueError(f"Unsupported dataset: {name}. Choose shopee or fpt.")
    root = MODELS
    meta = json.loads((root / f"results/{name}/manifest.json").read_text())
    frame = pd.read_csv(root / meta["prepared_series_file"], parse_dates=["timestamp"])
    arrays = np.load(root / meta["prepared_windows_file"])
    ids = arrays["index_test"]
    # Chọn cố định theo thời gian, tuyệt đối không tìm mẫu có sai số nhỏ nhất.
    target_index = int(ids[0])
    assert target_index == meta["splits"]["test"]["first_target_index"]
    lookback = meta["lookback"]
    context = frame.iloc[target_index - lookback : target_index].copy()
    target = frame.iloc[target_index]
    assert len(context) == lookback
    assert context.timestamp.is_monotonic_increasing and context.timestamp.is_unique
    assert context.timestamp.lt(target.timestamp).all()
    if name != "fpt":
        assert context.timestamp.diff().dropna().eq(pd.Timedelta(days=1)).all()
        assert target.timestamp - context.timestamp.iloc[-1] == pd.Timedelta(days=1)

    # Áp dụng thống kê train đã lưu; không fit lại trên context/test.
    norm = meta["normalization"]
    raw_inputs = context[meta["features"]].to_numpy()
    normalized = ((raw_inputs - norm["x_mean"]) / norm["x_scale"]).astype(np.float32)
    np.testing.assert_allclose(normalized, arrays["x_test"][0], rtol=1e-6, atol=1e-7)
    assert pd.Timestamp(norm["fit_last_timestamp"]) < context.timestamp.iloc[0]

    model_meta = meta["models"]["rnn"]
    checkpoint = root / model_meta["checkpoint_file"]
    model, saved, checkpoint_hash = load_checkpoint(
        checkpoint, model_meta["checkpoint_sha256"]
    )
    scaled, hidden = predict_saved_windows(model, arrays["x_test"])
    assert hidden is not None and hidden.shape == (lookback, saved["hidden_size"])
    replayed = original_units(name, scaled, norm, frame.target.to_numpy()[ids - 1])

    # Tính MAE/RMSE trên mọi nhãn test, tách khỏi sai số của một ví dụ.
    tables = {}
    metric_values = {}
    for kind in ["rnn", "persistence"]:
        full = pd.read_csv(
            root / meta["models"][kind]["predictions_file"], parse_dates=["timestamp"]
        )
        table = full.loc[full.split.eq("test")].reset_index(drop=True)
        assert len(table) == len(ids) == meta["splits"]["test"]["n"]
        np.testing.assert_array_equal(table.target_index.to_numpy(), ids)
        np.testing.assert_allclose(
            table.actual, frame.target.to_numpy()[ids], rtol=0, atol=1e-10
        )
        assert table.timestamp.iloc[0] == target.timestamp
        errors = table.predicted.to_numpy() - table.actual.to_numpy()
        recomputed = dict(
            MAE=float(np.abs(errors).mean()),
            RMSE=float(np.sqrt(np.square(errors).mean())),
        )
        for metric, value in recomputed.items():
            np.testing.assert_allclose(
                value,
                meta["models"][kind]["metrics"]["test"][metric],
                rtol=1e-10,
                atol=1e-10,
            )
        tables[kind] = table
        metric_values[kind] = recomputed
    np.testing.assert_allclose(replayed, tables["rnn"].predicted, rtol=0, atol=1e-9)
    np.testing.assert_allclose(
        tables["persistence"].predicted,
        frame.target.to_numpy()[ids - 1],
        rtol=0,
        atol=1e-10,
    )
    prediction = float(tables["rnn"].predicted.iloc[0])
    baseline = float(tables["persistence"].predicted.iloc[0])
    prediction_difference = abs(float(replayed[0]) - prediction)

    # Đối chiếu độc lập từng trạng thái; không chỉ so dự đoán cuối cùng.
    manual = replay_recurrence(
        arrays["x_test"][0], saved["state_dict"], saved["hidden_size"]
    )
    np.testing.assert_allclose(manual, hidden, rtol=1e-5, atol=1e-6)
    calculations = trace_first_component(arrays["x_test"][0], saved["state_dict"], hidden)
    # Giữ hàng trọng số để kiểm tra từng tích x × w của ví dụ trên web;
    # không suy ngược trọng số bằng phép chia (không xác định khi x = 0).
    input_weights = saved["state_dict"]["recurrent.weight_ih_l0"][0]
    previous_weights = saved["state_dict"]["recurrent.weight_hh_l0"][0]
    assert len(input_weights) == saved["input_size"]
    assert len(previous_weights) == saved["hidden_size"]
    # Linear dùng đủ 32 giá trị của trạng thái cuối, không chỉ h_t[0] ở trên.
    output_weights = saved["state_dict"]["output.weight"][0]
    output_bias = saved["state_dict"]["output.bias"][0]
    with torch.no_grad():
        traced_output = output_weights @ torch.from_numpy(hidden[-1]) + output_bias
    np.testing.assert_allclose(traced_output.item(), scaled[0], rtol=1e-5, atol=1e-6)

    copy = COPY[name]
    return dict(
        id=name,
        title=copy["title"],
        question=copy["question"],
        unit=copy["unit"],
        stepUnit=copy["stepUnit"],
        lookback=lookback,
        inputSize=saved["input_size"],
        hiddenSize=saved["hidden_size"],
        featureNames=meta["features"],
        recurrentUnit=dict(
            inputWeights=input_weights.tolist(), previousWeights=previous_weights.tolist()
        ),
        outputLayer=dict(weights=output_weights.tolist(), bias=output_bias.item()),
        normalization=dict(targetMean=norm["y_mean"], targetScale=norm["y_scale"]),
        context=[
            dict(
                timestamp=row.timestamp.isoformat(),
                value=float(row.target),
                input=raw_inputs[i].tolist(),
                normalizedInput=arrays["x_test"][0, i].tolist(),
                hiddenState=hidden[i].tolist(),
                calculation=calculations[i],
            )
            for i, row in enumerate(context.itertuples())
        ],
        target=dict(
            timestamp=target.timestamp.isoformat(),
            value=float(target.target),
            prediction=prediction,
            baseline=baseline,
            predictedStandardized=float(scaled[0]),
            predictedTransformed=float(
                np.float64(scaled[0]) * norm["y_scale"] + norm["y_mean"]
            ),
            absoluteError=abs(prediction - float(target.target)),
            baselineAbsoluteError=abs(baseline - float(target.target)),
        ),
        metrics=dict(
            rnnMae=metric_values["rnn"]["MAE"],
            baselineMae=metric_values["persistence"]["MAE"],
            rnnRmse=metric_values["rnn"]["RMSE"],
            baselineRmse=metric_values["persistence"]["RMSE"],
            testCount=len(ids),
        ),
        notes=dict(
            **copy["notes"],
            selection="Mục tiêu test đầu tiên theo thứ tự thời gian, không chọn theo sai số. Đây là dự báo một bước bằng lịch sử quan sát; trạng thái RNN bắt đầu từ 0 cho mỗi cửa sổ. Hoạt ảnh phát lại checkpoint đã huấn luyện, không học lại trong trình duyệt.",
        ),
        source=dict(url=meta["audit"]["source_url"], clockNote=copy["clockNote"]),
        verification=dict(
            status="passed",
            targetIndex=target_index,
            checkpointSha256=checkpoint_hash,
            normalizedInputsMatchSavedWindow=True,
            contextStrictlyBeforeTarget=True,
            predictionMatchesSavedCSV=True,
            predictionAbsoluteDifference=prediction_difference,
            manualRecurrenceMaximumAbsoluteError=float(np.max(np.abs(manual - hidden))),
            fullTestMetricsRecomputed=True,
        ),
    )


def export():
    torch.set_num_threads(2)
    datasets = [export_dataset(name) for name in ["shopee", "fpt"]]
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    DESTINATION.write_text(
        json.dumps(
            dict(datasets=datasets),
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        )
    )
    print(
        json.dumps(
            dict(
                file=str(DESTINATION),
                bytes=DESTINATION.stat().st_size,
                datasets=[
                    dict(
                        id=data["id"],
                        target=data["target"],
                        metrics=data["metrics"],
                        verification=data["verification"],
                    )
                    for data in datasets
                ],
            ),
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    export()
