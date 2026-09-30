# RNN: Shopee Thailand và cổ phiếu FPT

Assignment 6 gồm hai phần: [`models/`](models/) là mã Python, checkpoint và kết quả; [`website/`](website/) là website demo bằng tiếng Việt.

Triển khai Vercel, Render và Neo4j Aura: [hướng dẫn cloud](models/hosting/README.md).

Shopee Thailand dùng **dữ liệu mô phỏng**, không phải dữ liệu chính thức từ Shopee hay khách hàng Việt Nam. Mỗi tập Kaggle có RNN và GRU được huấn luyện riêng. Màn hình `#demo` phát lại phép tính từ hai checkpoint RNN. Phần **Hỏi đáp** tham khảo các mô hình FPT riêng, dùng dữ liệu KBS/Vnstock và Python cho dự báo phiên kế tiếp cùng các thời hạn 1, 3 và 6 tháng.

## Dự báo FPT từ dữ liệu cập nhật

Xem [cách chạy Python, lấy dữ liệu, huấn luyện và kiểm chứng](models/daily/README.md). Website có nút **Dự báo FPT** để mở `#fpt-daily`; nút **Cập nhật & dự báo** lấy dữ liệu mới bằng mô hình đã lưu. Cần chạy Python API ở cổng 8006 cùng website ở 4173. Nếu API chưa chạy, website ghi rõ đang xem bản đã lưu. Không tự đặt lịch cập nhật hoặc tự huấn luyện.

Run ngày 07/10/2026 dùng 1.935 phiên KBS từ 2019 đến 06/10/2026. Trên 287 mục tiêu test, RNN có MAE 1.184,56 VND, baseline giữ giá có MAE 1.174,18 VND. Website hiển thị cả hai, không tuyên bố RNN tốt hơn. Dữ liệu gốc và cache nằm ngoài Git; checkpoint và bằng chứng đánh giá nằm trong `models/daily/artifacts/`.

## Chạy website

Dùng Node.js 22 trở lên. Từ thư mục `website/`:

```sh
npm ci
npm run build
npm run preview -- --port 4173 --strictPort
```

Mở [demo cục bộ](http://127.0.0.1:4173/#demo). Chạy tập đang chọn, đọc chuỗi rồi dừng ở Dự đoán. Bấm **Xem thực tế** và **Xem toàn tập** khi sẵn sàng. Chọn FPT để chạy tập thứ hai. **Tổng kết** mở bằng tay; hai tập không chạy cùng lúc.

## Đọc và chạy Python

[Bản đồ code](models/CODE_MAP_VI.md) chỉ từng hàm và code cho Phần 5 của bài thuyết trình. [Hướng dẫn mô hình](models/README.md) ghi cách cài Python và kiểm chứng kết quả.

Từ thư mục `models/`, sau khi cài `requirements.txt`:

```sh
python src/experiments.py --verify-only --no-write
python scripts/independent_audit.py --skip-raw --no-write
```

Tải CSV gốc và huấn luyện lại khi cần:

```sh
python scripts/download_data.py
python src/experiments.py --dataset shopee
python src/experiments.py --dataset fpt
```

| Bài toán | Đầu vào | Mục tiêu | Số mục tiêu test |
| --- | --- | --- | ---: |
| Shopee Thailand, mô phỏng | 30 ngày × 5 số đếm hành vi qua log1p | Số đơn ngày tiếp theo | 216 |
| FPT | 30 phiên × 1 lợi suất log | Giá đóng cửa phiên tiếp theo | 389 |

Ở Shopee, RNN có MAE 309,75 đơn/ngày, cao hơn cách đoán như hôm trước (141,56). Trên FPT, RNN cũng chưa tốt hơn cách giữ giá phiên trước. Kết quả chỉ thuộc một seed và một lần chia theo thời gian; không chứng minh ưu thế thực tế.

Nguồn: [Shopee Thailand simulation](https://www.kaggle.com/datasets/hninshwezinhlaing/shopee-th-customer-journey-and-operations-dataset), Hnin Shwe Zin Hlaing, version 1, CC BY-SA 4.0; [FPT](https://www.kaggle.com/datasets/thangtranquang/stock-vn30-vietnam), Thang Tran, version 1, CC0. Hash và schema nằm trong [source_manifest.json](models/data/source_manifest.json). CSV gốc không được đưa vào Git hoặc ZIP; dữ liệu tổng hợp và checkpoint đã có sẵn.

Các phiên bản Amazon và Retailrocket cũ được lưu ngoài Assignment 6 trong `assignment6_archive/`. Repo GitHub hiện giữ URL cũ cho đến khi chủ động đổi tên.
# Chat đầu tư FPT

Website có màn hình **Chat đầu tư** tại `#chat`, dùng API ngôn ngữ + Neo4j/RAG để giải thích dữ liệu FPT và tính kịch bản vốn. Cài đặt, cấu hình key ngoài Git và demo: [models/chat/README.md](models/chat/README.md). Chat cần Python API và Neo4j chạy cục bộ, không hoạt động chỉ bằng static hosting.
