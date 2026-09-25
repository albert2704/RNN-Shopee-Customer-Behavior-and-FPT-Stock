"""RNN một số vô hướng: tự tính forward, BPTT rồi kiểm tra bằng autograd.

Ví dụ giảng dạy có 3 bước thời gian, không phải mô hình của bộ dữ liệu.
Loss = 1/2 * (dự báo - đích)^2 để đạo hàm dễ nhìn; A6 dùng mean MSE.
Chạy tệp sẽ ghi results/toy_rnn.json; import chỉ cung cấp các hàm.
"""

from pathlib import Path
import json
import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]


def forward(x, params):
    """Đọc x từ trái sang phải; cùng wx, wh, b dùng ở mọi bước."""
    h = 0.0  # h0: chưa nhận dữ liệu nào, bộ nhớ ban đầu bằng 0.
    steps = []
    for t, value in enumerate(x, 1):
        # Trọng số giữ nguyên trong forward; chỉ trạng thái h thay đổi.
        previous = h
        a = params["wx"] * value + params["wh"] * previous + params["b"]
        h = float(np.tanh(a))
        steps.append(
            dict(
                t=t,
                x=float(value),
                h_previous=previous,
                input_contribution=params["wx"] * value,
                memory_contribution=params["wh"] * previous,
                preactivation=a,
                h=h,
            )
        )
    pred = params["wy"] * h + params["by"]
    return pred, steps


def loss(x, params, target):
    """Sai số một đích, có hệ số 1/2: dL/d(pred) = pred - target."""
    pred, _ = forward(x, params)
    return 0.5 * (pred - target) ** 2


def manual_bptt(x, params, target):
    """BPTT: đi ngược thời gian và cộng đóng góp vào tham số dùng chung."""
    pred, steps = forward(x, params)
    error = pred - target
    grad = dict(wx=0.0, wh=0.0, b=0.0, wy=error * steps[-1]["h"], by=error)
    # Quy tắc dây chuyền: L -> dự báo -> trạng thái cuối.
    dh = error * params["wy"]
    backward = []
    for row in reversed(steps):
        # h = tanh(a), nên dh/da = 1 - h^2.
        da = dh * (1 - row["h"] ** 2)
        gx, gh, gb = da * row["x"], da * row["h_previous"], da
        # wx/wh/b được dùng lại nhiều lần: gradient là TỔNG các đóng góp.
        grad["wx"] += gx
        grad["wh"] += gh
        grad["b"] += gb
        backward.append(
            dict(
                t=row["t"],
                dL_dh=dh,
                dL_da=da,
                wx_contribution=gx,
                wh_contribution=gh,
                b_contribution=gb,
            )
        )
        # Đưa gradient về trạng thái ở bước trước, tiếp tục lần ngược.
        dh = da * params["wh"]
    return grad, backward


def run():
    """So ba cách tính gradient rồi thực hiện đúng một bước SGD minh họa."""
    x, target, lr = [0.2, -0.1, 0.4], 0.3, 0.1
    params = dict(wx=0.5, wh=0.8, b=0.1, wy=1.2, by=-0.05)
    pred, steps = forward(x, params)
    grads, backward = manual_bptt(x, params, target)
    p = {
        k: torch.tensor(v, dtype=torch.float64, requires_grad=True)
        for k, v in params.items()
    }
    h = torch.zeros((), dtype=torch.float64)
    for value in x:
        h = torch.tanh(p["wx"] * value + p["wh"] * h + p["b"])
    torch_pred = p["wy"] * h + p["by"]
    torch_loss = 0.5 * (torch_pred - target).square()
    # Autograd tự đi qua đồ thị phép tính, không cần gọi nn.RNN.
    torch_loss.backward()
    autograd = {k: float(v.grad) for k, v in p.items()}
    # Sai phân trung tâm xấp xỉ đạo hàm: [L(w+eps)-L(w-eps)]/(2eps).
    eps = 1e-6
    finite = {}
    for key in params:
        plus, minus = dict(params), dict(params)
        plus[key] += eps
        minus[key] -= eps
        finite[key] = (loss(x, plus, target) - loss(x, minus, target)) / (2 * eps)
    max_ag = max(abs(grads[k] - autograd[k]) for k in params)
    max_fd = max(abs(grads[k] - finite[k]) for k in params)
    assert max_ag < 1e-12 and max_fd < 1e-8
    # Ví dụ dùng SGD giản đơn; thí nghiệm thật trong training.py dùng Adam.
    updated = {key: value - lr * grads[key] for key, value in params.items()}
    new_pred, _ = forward(x, updated)
    result = dict(
        example_only=True,
        x=x,
        target=target,
        h0=0,
        params=params,
        steps=steps,
        prediction=pred,
        loss=loss(x, params, target),
        backward_steps=backward,
        gradients_manual=grads,
        gradients_autograd=autograd,
        gradients_finite_difference=finite,
        finite_difference_epsilon=eps,
        learning_rate=lr,
        updated_params=updated,
        updated_prediction=new_pred,
        updated_loss=loss(x, updated, target),
        max_abs_manual_autograd_error=max_ag,
        max_abs_manual_finite_difference_error=max_fd,
        note="Teaching loss is half squared error. Experiments use mean squared error.",
    )
    (ROOT / "results").mkdir(parents=True, exist_ok=True)
    (ROOT / "results/toy_rnn.json").write_text(
        json.dumps(result, indent=2), encoding="utf-8"
    )
    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    run()
