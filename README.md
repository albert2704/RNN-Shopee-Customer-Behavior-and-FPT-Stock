# RNN - Retailrocket and Amazon Stock

Assignment 6 · Recurrent Neural Networks

Thí nghiệm dự báo chuỗi thời gian bằng PyTorch và website giải thích trực quan bằng tiếng Việt. Hai bộ dữ liệu **Retailrocket** và **Amazon AMZN** có một RNN và một GRU được huấn luyện riêng cho mỗi tập: **bốn mạng đã huấn luyện**. Website phát lại phép tính từ hai checkpoint RNN.

| Thư mục | Nội dung |
|---|---|
| [models/](models/README.md) | Mã Python, checkpoint, dữ liệu đã xử lý, dự đoán và kiểm chứng |
| [website/](website/README.md) | Demo React/TypeScript, biểu đồ, phép tính trạng thái và hướng dẫn trình bày |

Đọc [bản đồ code](models/CODE_MAP_VI.md) để tìm câu hỏi → hàm → tệp. Bắt đầu với [mô hình](models/src/models.py), [chuẩn bị dữ liệu](models/src/preprocessing.py) và [vòng lặp huấn luyện](models/src/training.py).

**Code cho Phần 5 (slide 20–25):** dùng trực tiếp [training.py](models/src/training.py), [toy_rnn.py](models/src/toy_rnn.py) và [models.py](models/src/models.py). [Bản đồ theo slide](models/CODE_MAP_VI.md#phần-5--slide-2025) chỉ đúng hàm cần mở.

## Chạy website

Cần Node.js 22.18+ và npm. Từ thư mục repository:

```sh
cd website
npm ci
npm run build
npm run preview -- --port 4173 --strictPort
```

Mở [demo cục bộ](http://127.0.0.1:4173/#demo), bấm **Chạy cả 2 demo** để xem Retailrocket → Amazon → tổng kết. Website dùng dữ liệu đã xuất sẵn; không cần chạy Python hay huấn luyện lại.

## Kiểm chứng và huấn luyện

Cần Python 3.12. Từ thư mục repository:

```sh
cd models
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python src/experiments.py --verify-only --no-write
python scripts/independent_audit.py --skip-raw --no-write
```

Để tải CSV gốc, kiểm toán cả bước xử lý dữ liệu hoặc huấn luyện lại:

```sh
python scripts/download_data.py
python scripts/independent_audit.py --no-write
python src/experiments.py --dataset retailrocket
python src/experiments.py --dataset amazon
```

Hai lệnh cuối ghi lại checkpoint, dự đoán và kết quả tương ứng. [Hướng dẫn mô hình](models/README.md) giải thích dữ liệu, các hàm và giao thức đánh giá.

Retailrocket dùng 24 giờ trước để dự báo số sự kiện giao dịch giờ tới; Amazon dùng 30 lợi suất log trước để dự báo phiên tới rồi đổi về giá điều chỉnh. Kết quả đã lưu cho thấy RNN tốt hơn baseline giữ nguyên trên Retailrocket; Amazon chưa có lợi thế nhất quán. Đây là dự báo một bước với một seed và một split theo thời gian.
