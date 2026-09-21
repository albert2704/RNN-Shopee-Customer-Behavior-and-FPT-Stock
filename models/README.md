# Mô hình RNN và GRU

Hai tập **Retailrocket** và **Amazon AMZN** được huấn luyện riêng với RNN và GRU: tổng cộng bốn mạng. Mỗi mạng có một lớp truy hồi, trạng thái 32 chiều và đầu ra `Linear(32, 1)`. [CODE_MAP_VI.md](CODE_MAP_VI.md) nối các câu hỏi thường gặp với mã nguồn.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `src/` | Chuẩn bị dữ liệu, mô hình, huấn luyện, đánh giá và ví dụ tính tay |
| `scripts/` | Tải dữ liệu và kiểm chứng độc lập |
| `checkpoints/` | Bốn tệp trọng số `.pt` cùng cấu hình đã lưu |
| `data/processed/` | Chuỗi CSV và cửa sổ NumPy `.npz` cho train/validation/test |
| `data/source_manifest.json` | Nguồn, schema, giấy phép và SHA-256 của CSV gốc |
| `results/` | Cấu hình, metric, dự đoán, lịch sử loss và bản chụp mã của lần chạy |

CSV gốc được tải vào `data/raw/` khi cần. Website dùng các bản xuất JSON đã có trong [`../website/public/data/`](../website/public/data/), nên có thể chạy độc lập với Python.

## Cài đặt

Chạy các lệnh dưới đây từ thư mục `models/`. Dùng Python 3.12 trong môi trường riêng:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Kết quả lịch sử chạy trên CPU macOS ARM64, Python 3.12.14 và PyTorch 2.14.0; chi tiết ở [`results/summary.json`](results/summary.json). Khác phiên bản hoặc phần cứng có thể tạo sai khác số học.

## Code cho Phần 5 của bài thuyết trình

Dùng trực tiếp mã hiện có: [training.py](src/training.py) cho loss, vòng học và gradient clipping; [toy_rnn.py](src/toy_rnn.py) cho BPTT và tích đạo hàm; [models.py](src/models.py) cho kiến trúc và forward. [Bản đồ theo slide 20–25](CODE_MAP_VI.md#phần-5--slide-2025) chỉ rõ hàm và từ khóa cần chụp lên slide.

## Kiểm chứng kết quả đã lưu

Kiểm tra dữ liệu đã chuẩn bị, scaler, metric, epoch được chọn và hash checkpoint mà không đổi kết quả:

```sh
python src/experiments.py --verify-only --no-write
python scripts/independent_audit.py --skip-raw --no-write
```

Lệnh thứ hai kiểm toán mọi cửa sổ, baseline/MAE/RMSE và nạp cả bốn checkpoint bằng lớp mạng riêng. `--skip-raw` bỏ qua bước dựng lại dữ liệu từ CSV gốc. Để kiểm toán thêm bước đó:

```sh
python scripts/download_data.py
python scripts/independent_audit.py --no-write
```

Các JSON kiểm chứng trong `results/` ghi nhận lần chạy đã lưu; chúng không thay thế việc chạy lại các lệnh ở môi trường mới. Các lệnh kiểm chứng không huấn luyện.

## Huấn luyện lại

Tải dữ liệu trước nếu chưa có `data/raw/events.csv` và `data/raw/AMZN.csv`:

```sh
python scripts/download_data.py
python src/experiments.py
```

Hoặc chạy một tập:

```sh
python src/experiments.py --dataset retailrocket
python src/experiments.py --dataset amazon
```

Huấn luyện ghi lại checkpoint, dữ liệu đã chuẩn bị, lịch sử loss, dự đoán, metric và biểu đồ của tập tương ứng. Chọn checkpoint bằng validation; chỉ chấm test sau khi huấn luyện xong. Có thể chạy ví dụ scalar riêng bằng `python src/toy_rnn.py`; lệnh này ghi `results/toy_rnn.json`.

Sau khi đổi kết quả mô hình, xuất lại dữ liệu website từ thư mục repository:

```sh
python website/scripts/export_data.py retailrocket amazon
python website/scripts/export_demo.py
python website/scripts/package_source.py
```

## Các hàm chính

| Tệp | Hàm/lớp cần đọc | Vai trò |
|---|---|---|
| [experiments.py](src/experiments.py) | `main` | Chọn tập, nối các bước và ghi kết quả |
| [preprocessing.py](src/preprocessing.py) | `prepare_retailrocket`, `prepare_amazon`, `prepare_data` | Làm sạch, tạo đặc trưng, chia thời gian, chuẩn hóa và tạo cửa sổ |
| [models.py](src/models.py) | `RecurrentForecaster.__init__`, `forward` | Tạo RNN/GRU và chuyển trạng thái cuối thành một dự đoán |
| [training.py](src/training.py) | `set_seed`, `fit_model` | Cố định seed, tối ưu Adam, dừng sớm và lưu checkpoint |
| [evaluation.py](src/evaluation.py) | `predict`, `original_units`, `metrics`, `evaluate` | Suy luận, hoàn nguyên đơn vị, baseline và MAE/RMSE |
| [verification.py](src/verification.py) | `verify_saved_outputs` | Đối chiếu dữ liệu và kết quả đã lưu |
| [plots.py](src/plots.py) | `plot_dataset` | Tạo biểu đồ từ dữ liệu và dự đoán |
| [io_utils.py](src/io_utils.py) | `save_json`, `sha256`, `archive_sources` | Ghi JSON, kiểm tra hash và lưu mã nguồn của lần chạy |
| [toy_rnn.py](src/toy_rnn.py) | `forward`, `loss`, `manual_bptt`, `run` | Ví dụ ba bước: forward, BPTT, kiểm tra gradient và một bước SGD |
| [independent_audit.py](scripts/independent_audit.py) | `audit_saved_dataset`, `audit_raw_transformations`, `audit_source_provenance` | Kiểm toán riêng dữ liệu, checkpoint và nguồn của lần chạy |

## Dữ liệu và giao thức

| Tập | Đầu vào → mục tiêu | Số cửa sổ train / validation / test |
|---|---|---:|
| Retailrocket | 24 giờ × 7 đặc trưng → số sự kiện transaction giờ tiếp theo | 2.284 / 489 / 491 |
| Amazon | 30 phiên × 1 lợi suất log → lợi suất phiên tới → giá Adj Close | 4.657 / 997 / 999 |

Retailrocket tổng hợp lượt xem, thêm giỏ và giao dịch theo giờ UTC; dùng `log1p` cho ba số đếm cùng sin/cos của giờ và thứ. Đếm transaction là đếm sự kiện, không phải đơn hàng duy nhất hay hành vi cá nhân. Amazon dùng lợi suất log; giá dự đoán bằng giá phiên trước nhân `exp` của lợi suất dự đoán. Không thêm cuối tuần hoặc ngày nghỉ.

Chia 70/15/15 theo thời gian nhãn; mỗi cửa sổ chỉ dùng quá khứ. Scaler chỉ fit trên train. Mỗi cửa sổ bắt đầu với trạng thái 0; dự báo một bước dùng lịch sử đã quan sát, kể cả các quan sát trước đó trong validation/test.

Cấu hình ở [config.py](src/config.py): hidden size 32, một lớp, không dropout, Adam 0,001, batch 64, gradient clipping 1, seed 42, tối đa 40 epoch, patience 8. Chọn checkpoint có MSE validation thấp nhất trong không gian mục tiêu đã biến đổi và chuẩn hóa. GRU có nhiều tham số hơn RNN dù cùng số chiều trạng thái.

## Kết quả test đã lưu

| Tập / đơn vị | Mô hình | MAE | RMSE |
|---|---|---:|---:|
| Retailrocket / sự kiện mỗi giờ | RNN | 2,5120 | 3,6459 |
| | GRU | 2,5453 | 3,7205 |
| | Giờ trước | 3,4582 | 4,8827 |
| | Cùng giờ tuần trước | 3,8126 | 5,6428 |
| Amazon / USD mỗi cổ phiếu điều chỉnh | RNN | 2,2687 | 3,1143 |
| | GRU | 2,2614 | 3,1064 |
| | Giá phiên trước | 2,2623 | 3,1048 |
| | Lợi suất log trung bình train | 2,2627 | 3,1093 |

RNN tốt nhất trong các cấu hình Retailrocket đã chạy. Trên Amazon, GRU nhỉnh hơn baseline giá phiên trước khoảng 0,04% về MAE nhưng kém RMSE; chưa có lợi thế nhất quán. Một seed và một split chưa chứng minh ưu thế tổng quát. Không so sánh trực tiếp MAE giữa hai tập có đơn vị khác nhau; đường giá gần thực tế không chứng minh khả năng sinh lời. `Adj Close` là dữ liệu điều chỉnh hồi cứu, không bảo đảm thông tin point-in-time cho backtest.

Nguồn: [Retailrocket](https://www.kaggle.com/datasets/retailrocket/ecommerce-dataset), CC BY-NC-SA 4.0; [Amazon / Henry Shan](https://www.kaggle.com/datasets/henryshan/amazon-com-inc-amzn), Apache 2.0 theo nguồn. Chi tiết và hash nằm trong `data/source_manifest.json`.
