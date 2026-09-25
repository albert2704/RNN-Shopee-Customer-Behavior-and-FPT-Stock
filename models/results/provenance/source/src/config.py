"""Cấu hình đã dùng trong A6: một lớp RNN/GRU, CPU, dự báo một bước.

lookback L nằm trong từng bộ dữ liệu; hidden_size H là số phần tử trạng thái.
Batch size là số cửa sổ mỗi lần cập nhật; epoch là một lượt qua tập train.
num_layers/dropout ghi lại kiến trúc cố định trong models.py; split_fractions
ghi lại tỷ lệ cố định trong preprocessing.py. Muốn đổi các lựa chọn này,
cần sửa phần thực thi tương ứng, không chỉ sửa metadata trong CONFIG.
Patience=8: dừng sau 8 epoch liên tiếp không cải thiện validation.
"""

CONFIG = dict(
    seed=42,
    hidden_size=32,
    num_layers=1,
    batch_size=64,
    learning_rate=0.001,
    max_epochs=40,
    patience=8,
    gradient_clip_norm=1.0,
    cpu_threads=2,
    dropout=0.0,
    split_fractions=[0.70, 0.15, 0.15],
    loss="MSE on standardized transformed target",
)
