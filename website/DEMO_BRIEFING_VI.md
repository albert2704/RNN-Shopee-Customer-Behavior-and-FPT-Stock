# Hướng dẫn người demo website và giải thích code

Bản giao diện ngày 08/10/2026: **Shopee Thailand (mô phỏng) → FPT → Tổng kết → Hỏi đáp**, cùng **Phụ lục** dữ liệu lịch sử. Kịch bản nói theo từng màn hình ở [PRESENTATION_GUIDE.md](PRESENTATION_GUIDE.md); các hàm, câu hỏi và code đưa lên slide ở [CODE_MAP_VI.md](../models/CODE_MAP_VI.md).

## Vai trò phần demo

Nhóm đã trình bày lý thuyết RNN. Phần của bạn nối lý thuyết với một đầu vào cụ thể, trạng thái thay đổi, dự đoán và cách đánh giá. Không cần giảng lại cả slide. Có thể dành 3–4 phút cho hai demo, mở code khi được hỏi.

Nói ngay từ đầu: hai demo đầu **phát lại phép tính từ checkpoint đã huấn luyện**. Không chạy PyTorch trong trình duyệt, không cập nhật trọng số khi bấm phát. Shopee là **100% dữ liệu mô phỏng Thailand**, không phải dữ liệu chính thức hoặc khách Việt Nam. Chat dùng dữ liệu FPT cập nhật từ dịch vụ Python và ghi ngày nguồn; không nhầm các con số này với ví dụ Kaggle cố định ở chương FPT.

## Những điểm cần khớp với slide

| Chủ đề | Cách triển khai trong Assignment 6 |
| --- | --- |
| Many-to-one | Một cửa sổ nhiều ngày/phiên cho một đầu ra; không có nhãn đầu ra ở mọi timestep. |
| Hàm đầu ra | Linear, không Softmax/Sigmoid. Sau Linear còn bỏ chuẩn hóa và hoàn nguyên đơn vị. |
| Loss | MSE trên mục tiêu đã biến đổi, chuẩn hóa; trung bình trên batch. |
| BPTT | Loss cuối cửa sổ truyền gradient qua mọi bước. `loss.backward()` dùng autograd. |
| Cập nhật | `optimizer.step()` dùng Adam sau mỗi batch, không phải sau mỗi bước của hoạt ảnh. |
| Gradient clipping | Giới hạn norm gradient ở 1.0; không khôi phục gradient đã biến mất. |
| GRU | Mô hình so sánh có cổng; hoạt ảnh chính giải thích RNN thường. |

Ví dụ scalar ba bước với SGD và loss ½(ŷ−y)² là minh họa riêng, không phải checkpoint Shopee/FPT. Không gọi tanh là phép lấy trung bình. Không gán ý nghĩa cụ thể cho một ô hidden state chưa được phân tích.

## Dữ liệu và mẫu minh họa

Shopee có 500.000 session, 2.696.481 activity, 300.000 đơn. Chuỗi giữ 1.461 ngày trong 2022–2025. 58 activity bắt đầu vào ngày 01/01/2026 được loại vì không có ngày mục tiêu đầy đủ. Nguồn không chỉ định múi giờ; giữ ngày nguồn, UTC trong CSV chỉ lưu nhãn.

Năm đầu vào mỗi ngày là số session bắt đầu, lượt thăm `/products`, `/cart`, `/checkout` và số đơn. Dùng log1p rồi chuẩn hóa train. Chỉ đưa **ngày đã kết thúc trước ngày mục tiêu** vào cửa sổ. Không lấy order link hoặc lượt thăm trang ngày đích để đoán chính ngày đó. Thăm `/cart` là thăm trang giỏ, không phải thao tác thêm sản phẩm.

| Tập | Shape x | Train / validation / test | Mẫu test đầu tiên |
| --- | --- | --- | --- |
| Shopee, mô phỏng | `(B, 30, 5)` | 1.001 / 214 / 216 | 30/05/2025: RNN 289,60; thực tế 301; hôm trước 300 đơn |
| FPT | `(B, 30, 1)` | 1.810 / 388 / 389 | 07/12/2021: RNN 94.550,51; thực tế 96.000; phiên trước 94.500 VND |

Mẫu chọn cố định là test đầu tiên theo thời gian, không tìm mẫu có dự đoán đẹp. Hidden state có 32 thành phần, được reset về 0 ở mỗi cửa sổ độc lập. Mỗi tập có RNN/GRU học riêng, tổng cộng bốn checkpoint.

## Mở Python từ đầu đến cuối

1. `experiments.main` nhận tên tập và seed, nối các bước.
2. `prepare_shopee` đọc ba CSV, kiểm tra ID và liên kết, đếm theo ngày, tạo log1p. `prepare_fpt` làm sạch FPT Close và tạo log return.
3. `prepare_data` chia theo ngày đích 70/15/15. Scaler chỉ fit train. Mỗi x là `[t−30, t)`, y thuộc t.
4. `RecurrentForecaster` tạo RNN hoặc GRU, lấy trạng thái cuối qua `Linear(32, 1)`.
5. `fit_model` dùng DataLoader batch 64, MSE, Adam 0,001. `zero_grad` → forward/loss → backward → clip → step. Validation chọn checkpoint; patience 8, tối đa 40 epoch.
6. `evaluate` chốt checkpoint rồi dự báo validation/test, đổi về đơn vị gốc, tính MAE/RMSE và baseline trên cùng ngày đích.
7. `verify_saved_outputs` và `independent_audit.py` kiểm tra scaler, mọi cửa sổ, raw transformations, dự đoán, checkpoint và nguồn mã.
8. `export_demo.py` nạp RNN, lấy trạng thái từng bước, kiểm tra công thức truy hồi và đầu ra Linear rồi xuất JSON.
9. React đọc JSON và điều khiển phần được hiển thị. Trọng số không đổi khi phát.

RNN: hₜ = tanh(Wₓxₜ + bₓ + Wₕhₜ₋₁ + bₕ). Wₓ có shape 32×5 ở Shopee hoặc 32×1 ở FPT; Wₕ là 32×32. Linear có 32 trọng số và một bias.

Shopee hoàn nguyên bằng max(0, expm1(z×σ_train+μ_train)). FPT dùng P_trước×exp(r̂). Số đơn dự đoán có thể là số thập phân vì đầu ra là hồi quy.

## Kết quả cần nói đúng

| Tập / mô hình | MAE | RMSE | Epoch đã chạy / chọn |
| --- | ---: | ---: | --- |
| Shopee RNN | 309,7479 đơn | 589,7574 đơn | 19 / 11 |
| Shopee GRU | 299,7403 đơn | 578,1637 đơn | 10 / 2 |
| Shopee hôm trước | 141,5556 đơn | 599,1383 đơn | Không học |
| Shopee cùng thứ tuần trước | 160,5972 đơn | 600,3748 đơn | Không học |
| FPT RNN | 1.059,9227 VND | 2.014,8085 VND | 9 / 1 |
| FPT GRU | 1.058,9405 VND | 2.002,0458 VND | 9 / 1 |
| FPT giá trước | 1.053,7275 VND | 2.000,7261 VND | Không học |

“Toàn tập” nghĩa là tất cả mục tiêu **test**, không phải train + validation + test. MAE lấy trung bình độ lệch tuyệt đối sau khi đổi về đơn vị gốc. Một trường hợp tốt không chứng minh mô hình tốt.

RNN/GRU Shopee chưa tốt hơn baseline hôm trước về MAE, dù RMSE thấp hơn một chút. Hai chỉ số xếp hạng khác vì RMSE phạt lỗi lớn mạnh hơn. FPT cũng chưa có lợi thế về MAE/RMSE. Không chỉnh cấu hình theo kết quả test, không tuyên bố hidden size 32 tối ưu. Kết quả mô phỏng không chứng minh hiệu quả thực tế trên Shopee.

## Nguồn và bằng chứng

[Shopee Thailand Customer Journey](https://www.kaggle.com/datasets/hninshwezinhlaing/shopee-th-customer-journey-and-operations-dataset): Hnin Shwe Zin Hlaing, version 1, 100% mô phỏng, CC BY-SA 4.0. [FPT](https://www.kaggle.com/datasets/thangtranquang/stock-vn30-vietnam): Thang Tran, version 1, CC0. FPT có Close, không có Adj Close hoặc phương pháp điều chỉnh.

Hash CSV, schema và caveat nằm trong `models/data/source_manifest.json`. Checkpoint, dự đoán và lịch sử nằm trong `models/results/`. Bản mã thực thi của từng tập nằm trong `models/results/provenance/<id>/`. Website và ZIP chỉ xuất dữ liệu tổng hợp, không xuất các ID khách hàng trong CSV gốc.

Mã trên GitHub cập nhật sau khi push. Khi trình bày bản local chưa push, có thể mở trực tiếp file trong editor theo CODE_MAP.
