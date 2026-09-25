# Mô hình RNN và GRU

Hai tập **Shopee Thailand (mô phỏng)** và **FPT** được huấn luyện riêng với RNN và GRU: tổng cộng bốn mạng. Mỗi mạng có một lớp truy hồi, trạng thái 32 chiều và đầu ra `Linear(32, 1)`. [CODE_MAP_VI.md](CODE_MAP_VI.md) nối các câu hỏi thường gặp với mã nguồn.

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

Tải dữ liệu trước nếu chưa có ba CSV Shopee trong `data/raw/` và `data/raw/FPT.csv`:

```sh
python scripts/download_data.py
python src/experiments.py
```

Hoặc chạy một tập:

```sh
python src/experiments.py --dataset shopee
python src/experiments.py --dataset fpt
```

Huấn luyện ghi lại checkpoint, dữ liệu đã chuẩn bị, lịch sử loss, dự đoán, metric và biểu đồ của tập tương ứng. Chọn checkpoint bằng validation; chỉ chấm test sau khi huấn luyện xong. Có thể chạy ví dụ scalar riêng bằng `python src/toy_rnn.py`; lệnh này ghi `results/toy_rnn.json`.

Sau khi đổi kết quả mô hình, xuất lại dữ liệu website từ thư mục repository:

```sh
python website/scripts/export_data.py shopee fpt
python website/scripts/export_demo.py
python website/scripts/package_source.py
```

## Các hàm chính

| Tệp | Hàm/lớp cần đọc | Vai trò |
|---|---|---|
| [experiments.py](src/experiments.py) | `main` | Chọn tập, nối các bước và ghi kết quả |
| [preprocessing.py](src/preprocessing.py) | `prepare_shopee`, `prepare_fpt`, `prepare_data` | Làm sạch, tạo đặc trưng, chia thời gian, chuẩn hóa và tạo cửa sổ |
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
| Shopee Thailand (mô phỏng) | 30 ngày × 5 đặc trưng → số đơn ngày tiếp theo | 1.001 / 214 / 216 |
| FPT | 30 phiên × 1 lợi suất log → lợi suất phiên tới → giá Close (VND) | 1.810 / 388 / 389 |

Shopee tổng hợp session bắt đầu, thăm trang sản phẩm, giỏ hàng, thanh toán và đơn hàng theo ngày nguồn; dùng log1p cho 5 số đếm. Một lượt thăm trang giỏ không đồng nghĩa thêm sản phẩm vào giỏ. `order_id` duy nhất nên mục tiêu là số đơn. Có 1.461 ngày trong 2022–2025. Nguồn không ghi múi giờ; UTC trong CSV là cách lưu nhãn ngày. Activity bắt đầu ở ngày 01/01/2026 ngoài khoảng mục tiêu được loại bỏ.

FPT dùng lợi suất log; giá dự đoán bằng giá phiên trước nhân exp của lợi suất dự đoán. Không thêm cuối tuần hoặc ngày nghỉ.

Chia 70/15/15 theo thời gian nhãn; mỗi cửa sổ chỉ dùng quá khứ. Scaler chỉ fit trên train. Mỗi cửa sổ bắt đầu với trạng thái 0; dự báo một bước dùng lịch sử đã quan sát, kể cả các quan sát trước đó trong validation/test.

Cấu hình ở [config.py](src/config.py): hidden size 32, một lớp, không dropout, Adam 0,001, batch 64, gradient clipping 1, seed 42, tối đa 40 epoch, patience 8. Chọn checkpoint có MSE validation thấp nhất trong không gian mục tiêu đã biến đổi và chuẩn hóa. GRU có nhiều tham số hơn RNN dù cùng số chiều trạng thái.

## Kết quả test đã lưu

| Tập / đơn vị | Mô hình | MAE | RMSE |
|---|---|---:|---:|
| Shopee Thailand / đơn mỗi ngày | RNN | 309,7479 | 589,7574 |
| | GRU | 299,7403 | 578,1637 |
| | Hôm trước | 141,5556 | 599,1383 |
| | Cùng thứ tuần trước | 160,5972 | 600,3748 |
| FPT / VND mỗi cổ phiếu | RNN | 1.059,9227 | 2.014,8085 |
|  | GRU | 1.058,9405 | 2.002,0458 |
|  | Giá phiên trước | 1.053,7275 | 2.000,7261 |
|  | Lợi suất log trung bình train | 1.054,2121 | 2.000,9743 |

RNN và GRU Shopee có MAE cao hơn cách đoán như hôm trước, dù RMSE thấp hơn một chút. Trên FPT, cả hai có MAE/RMSE cao hơn cách giữ giá phiên trước. Một seed và một split chưa chứng minh ưu thế tổng quát. Không so trực tiếp MAE giữa các tập khác đơn vị.

Nguồn Shopee: [Hnin Shwe Zin Hlaing trên Kaggle](https://www.kaggle.com/datasets/hninshwezinhlaing/shopee-th-customer-journey-and-operations-dataset), phiên bản 1, **CC BY-SA 4.0, 100% dữ liệu mô phỏng**. Đây không phải dữ liệu chính thức của Shopee hoặc thị trường Việt Nam. Ba CSV có 500.000 session, 2.696.481 activity và 300.000 đơn. Hash, schema và nguồn ở `data/source_manifest.json`; CSV gốc không được đóng gói vào ZIP.

Nguồn FPT: [Thang Tran trên Kaggle](https://www.kaggle.com/datasets/thangtranquang/stock-vn30-vietnam), CC0: Public Domain.

Shopee RNN chạy 19 epoch, chọn epoch 11; GRU chạy 10 epoch, chọn epoch 2 bằng validation MSE. Không chỉnh cấu hình theo test. Bản mã đã tạo checkpoint nằm trong `results/provenance/shopee/`; FPT giữ snapshot riêng để một lần chạy tập khác không làm mất bằng chứng nguồn.

FPT có 2.706 dòng gốc: loại 87 dòng trùng hoàn toàn và 1 dòng trùng ngày/OHLCV, còn 2.618 phiên, tạo 2.617 lợi suất log. `Time` trống không dùng. Sáu dòng có trường OHLC phụ không nhất quán; Close dương được giữ, các trường phụ không được dùng hay sửa. RNN và GRU FPT chạy 9 epoch, chọn checkpoint epoch 1 bằng validation MSE. Amazon cũ được lưu ngoài Assignment 6, trong `assignment6_archive/amazon_before_fpt/`.

Retailrocket cũ nằm ngoài repository, trong `assignment6_archive/retailrocket_before_shopee/`.
