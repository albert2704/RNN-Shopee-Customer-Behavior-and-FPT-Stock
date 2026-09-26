"""Kiến trúc giữ nguyên tên recurrent/output để đọc checkpoint cũ."""

from torch import nn


class RecurrentForecaster(nn.Module):
    """Đọc L bước quá khứ, xuất một số dự báo (many-to-one).

    x: (B, L, F); sequence: (B, L, H); hidden: (1, B, H).
    B = batch size, L = lookback, F = số đặc trưng, H = hidden size.
    RNN/GRU một lớp, một chiều; H=32 trong thí nghiệm đã lưu.
    """

    def __init__(self, input_size, kind="rnn", hidden_size=32):
        super().__init__()
        cls = nn.RNN if kind == "rnn" else nn.GRU
        self.recurrent = cls(
            input_size,
            hidden_size,
            num_layers=1,
            batch_first=True,
            bidirectional=False,
            dropout=0.0,
        )
        self.output = nn.Linear(hidden_size, 1)

    def forward(self, x):
        # Không truyền h0: PyTorch tạo trạng thái 0 cho từng cửa sổ.
        # h thay đổi theo bước; cùng bộ trọng số được dùng tại mọi bước.
        sequence, hidden = self.recurrent(x)
        # Lấy trạng thái sau hàng cuối (t-1), không phải đặc trưng tại t.
        # (B, L, H) -> (B, H) -> Linear -> (B, 1).
        return self.output(sequence[:, -1, :])
