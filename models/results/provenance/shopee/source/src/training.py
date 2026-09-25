"""Vòng lặp train -> validation -> chọn và lưu checkpoint.

Không fit scaler ở đây, không lấy test để chọn epoch hoặc siêu tham số.
"""

import copy
import random
import time
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from evaluation import predict
from io_utils import sha256
from models import RecurrentForecaster


def set_seed(seed=42, *, config):
    """Cố định nguồn ngẫu nhiên trên môi trường CPU hiện tại.

    Seed không bảo đảm bit giống nhau giữa mọi phiên bản/thư viện/phần cứng.
    """
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(config["cpu_threads"])
    torch.use_deterministic_algorithms(True)


def fit_model(name, kind, arrays, meta, *, root, config):
    """Huấn luyện và trả checkpoint có validation MSE thấp nhất.

    root/config là tham số bắt buộc, được truyền từ điểm chạy A6.
    Mỗi batch chứa các cửa sổ độc lập; h0 không nối từ batch trước.
    """
    set_seed(config["seed"], config=config)
    model = RecurrentForecaster(len(meta["features"]), kind, config["hidden_size"])
    optimizer = torch.optim.Adam(model.parameters(), lr=config["learning_rate"])
    loss_fn = nn.MSELoss()
    generator = torch.Generator().manual_seed(config["seed"])
    # shuffle chỉ đổi thứ tự cửa sổ train, không đảo thứ tự L bước trong X.
    # Không shuffle toàn bộ dữ liệu trước khi chia train/validation/test.
    loader = DataLoader(
        TensorDataset(
            torch.from_numpy(arrays["x_train"]), torch.from_numpy(arrays["y_train"])
        ),
        batch_size=config["batch_size"],
        shuffle=True,
        generator=generator,
        num_workers=0,
    )
    history, best_loss, best_state, best_epoch, stale = [], float("inf"), None, 0, 0
    start = time.perf_counter()
    for epoch in range(1, config["max_epochs"] + 1):
        # predict() dùng eval(); đầu epoch phải trở lại chế độ train.
        model.train()
        total, seen = 0.0, 0
        for x, y in loader:
            # PyTorch cộng dồn gradient: xóa gradient cũ trước batch mới.
            optimizer.zero_grad(set_to_none=True)
            loss = loss_fn(model(x), y)
            # 1) backward: đạo hàm qua L bước (BPTT), cộng vào .grad.
            loss.backward()
            # 2) clip: hạn chế norm gradient; chưa sửa trọng số.
            nn.utils.clip_grad_norm_(model.parameters(), config["gradient_clip_norm"])
            # 3) Adam cập nhật trọng số bằng gradient vừa được clip.
            optimizer.step()
            total += float(loss.detach()) * len(x)
            seen += len(x)
        # Validation không cập nhật trọng số; test chưa được đọc ở đây.
        val_pred = predict(model, arrays["x_validation"])
        val_mse = float(np.square(val_pred - arrays["y_validation"].reshape(-1)).mean())
        history.append(
            dict(epoch=epoch, train_loss=total / seen, validation_loss=val_mse)
        )
        if val_mse < best_loss:
            best_loss, best_epoch, stale = val_mse, epoch, 0
            # Sao chép thật: giữ checkpoint tốt nhất, tránh tham chiếu bị đổi.
            best_state = copy.deepcopy(model.state_dict())
        else:
            stale += 1
        print(
            f"{name}/{kind} epoch={epoch:02d} train={total/seen:.6f} val={val_mse:.6f}",
            flush=True,
        )
        # Early stopping: dừng khi nhiều epoch liên tiếp không cải thiện.
        if stale >= config["patience"]:
            break
    assert best_state is not None
    model.load_state_dict(best_state)
    checkpoint = root / "checkpoints" / f"{name}_{kind}.pt"
    checkpoint.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        dict(
            state_dict=best_state,
            kind=kind,
            input_size=len(meta["features"]),
            hidden_size=config["hidden_size"],
            config=config,
            normalization=meta["normalization"],
            features=meta["features"],
            lookback=meta["lookback"],
            best_epoch=best_epoch,
            best_validation_loss=best_loss,
            target_transform=meta["target_transform"],
        ),
        checkpoint,
    )
    # Nạp lại checkpoint và so dự báo validation trước khi chấm test.
    saved = torch.load(checkpoint, map_location="cpu", weights_only=True)
    restored = RecurrentForecaster(
        saved["input_size"], saved["kind"], saved["hidden_size"]
    )
    restored.load_state_dict(saved["state_dict"])
    assert np.array_equal(
        predict(model, arrays["x_validation"][:32]),
        predict(restored, arrays["x_validation"][:32]),
    )
    folder = root / "results" / name
    folder.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(history).to_csv(folder / f"{kind}_history.csv", index=False)
    result = dict(
        best_epoch=best_epoch,
        epochs_run=len(history),
        best_validation_loss=best_loss,
        parameters=sum(p.numel() for p in model.parameters()),
        seconds=time.perf_counter() - start,
        history_file=f"results/{name}/{kind}_history.csv",
        checkpoint_file=f"checkpoints/{name}_{kind}.pt",
        checkpoint_sha256=sha256(checkpoint),
        selection="Minimum validation transformed-space MSE; test is not read during optimization/selection.",
    )
    return restored, result
