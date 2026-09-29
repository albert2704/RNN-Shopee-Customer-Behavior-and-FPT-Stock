# Kịch bản demo Shopee Thailand và FPT

Dùng phần này sau khi nhóm đã giải thích RNN qua slide. Hai demo đầu phát lại checkpoint đã huấn luyện, không học hoặc chạy dự đoán mới trong trình duyệt. Sau Tổng kết là phần Hỏi đáp với dữ liệu FPT.

## Mở đầu

> Sau phần lý thuyết, em sẽ minh họa cách RNN đọc dữ liệu theo thời gian rồi tạo một dự đoán. Có hai bài toán: dự báo số đơn ngày mai từ dữ liệu mô phỏng Shopee Thailand, và dự báo giá đóng cửa phiên sau của FPT. Hai tập có mô hình được huấn luyện riêng. Website phát lại phép tính đã xuất từ Python để mình nhìn rõ từng bước.

Nói rõ **mô phỏng Shopee Thailand**, không gọi là dữ liệu chính thức từ Shopee hay dữ liệu khách Việt Nam.

## Shopee: đọc lịch sử

Chọn Shopee Thailand, bấm **Chạy tập này**.

> Nhóm tổng hợp dữ liệu thành từng ngày. Một ngày gồm năm số: lượt truy cập, thăm trang sản phẩm, giỏ hàng, thanh toán và số đơn. RNN đọc 30 ngày trước để đoán số đơn ngày tiếp theo. Lượt thăm giỏ là thăm trang, không nhất thiết là thao tác thêm sản phẩm vào giỏ.

Chỉ bảng đầu vào và sơ đồ. Dừng ở bước 1 hoặc 2 nếu cần:

> Trạng thái bắt đầu bằng 32 số 0. RNN kết hợp năm đầu vào mới với trạng thái trước, qua trọng số và tanh để tạo 32 số mới. Sang ngày kế tiếp, trạng thái vừa tạo trở thành trạng thái trước. Trạng thái thay đổi, còn trọng số đã học giữ nguyên.

> 32 là số thành phần của trạng thái, không phải 32 ngày hay 32 loại hành vi. Mỗi ô màu biểu diễn một giá trị số; nhóm chưa gán cho từng ô một nghĩa cụ thể như xu hướng mua sắm.

Từ bước 3, để hoạt ảnh chạy nhanh. Demo sẽ tự dừng ở Dự đoán.

## Shopee: dự đoán và đối chiếu

> Sau 30 ngày, Linear dùng trạng thái cuối để tạo một đầu ra. Nhóm bỏ chuẩn hóa và hoàn tác log1p để có số đơn dự đoán. Ngày test đầu tiên là 30/05/2025, RNN dự đoán khoảng 289,60 đơn.

Bấm **Xem thực tế**:

> Dữ liệu ghi nhận 301 đơn, nên RNN lệch khoảng 11,40 đơn. Cách đoán đơn giản lấy số đơn hôm trước là 300, chỉ lệch 1 đơn. Đây là một ví dụ, chưa đại diện toàn bộ mô hình.

Bấm **Xem toàn tập**:

> Nhóm kiểm tra 216 ngày. MAE là lấy độ lệch tuyệt đối ở từng ngày rồi tính trung bình. RNN lệch khoảng 309,75 đơn/ngày, còn cách đoán như hôm trước lệch 141,56. RNN chưa tốt hơn về MAE trong lần thử này. Đây là dữ liệu mô phỏng, nên kết quả cũng không chứng minh hiệu quả trên Shopee thực tế.

Nếu được hỏi RMSE: RNN 589,76, giữ hôm trước 599,14. RMSE phạt sai số lớn mạnh hơn, nên thứ hạng có thể khác MAE. Không chọn một chỉ số để khẳng định mô hình tốt hơn ở mọi mặt.

## FPT

Bấm **Sang FPT**, rồi **Chạy tập này**. Giữ phần giải thích ngắn vì cơ chế RNN đã được minh họa:

> Cách cập nhật trạng thái giống nhau, nhưng dữ liệu và trọng số được học riêng. Mỗi phiên có một log return, tức mức thay đổi giá theo log. RNN đọc 30 phiên. Đường biểu đồ vẫn hiển thị giá VND để dễ hiểu.

Ở Dự đoán:

> Nhóm hoàn nguyên lợi suất dự đoán rồi nhân giá phiên cuối với exp của lợi suất đó. Dự báo đầu tiên khoảng 94.550,51 VND.

Bấm **Xem thực tế**, rồi **Xem toàn tập**:

> Thực tế là 96.000 VND. Sai số ví dụ này khoảng 1.449,49 VND. Nhưng trên 389 phiên test, MAE RNN khoảng 1.059,92 VND, cao hơn cách giữ giá phiên trước là 1.053,73 VND. Vì vậy nhóm chưa thấy lợi thế về MAE trên lần thử này.

## Tổng kết và mở code

Mở **Tổng kết** bằng tay:

> Hai ví dụ cho thấy cách RNN xử lý chuỗi và cách kiểm tra một dự báo. Mô hình phức tạp không tự động tốt hơn cách đoán đơn giản. Nhóm dùng test theo thời gian và so với baseline; không so trực tiếp số MAE giữa các tập khác đơn vị.

Chỉ mở code khi được hỏi. Bản đồ đầy đủ nằm ở [CODE_MAP_VI.md](../models/CODE_MAP_VI.md):

| Câu hỏi | Mở code |
| --- | --- |
| Chuẩn bị dữ liệu Shopee ở đâu? | `models/src/preprocessing.py`, `prepare_shopee`, `daily_count`, `prepare_data` |
| Tạo RNN/GRU và hidden size ở đâu? | `models/src/models.py`, `RecurrentForecaster`; `config.py` |
| Chỗ mô hình học? | `models/src/training.py`, `fit_model`, `backward`, `optimizer.step` |
| “Toàn tập” tính ở đâu? | `models/src/evaluation.py`, `metrics`, `evaluate` |
| Các trạng thái trong hoạt ảnh lấy ở đâu? | `website/scripts/export_demo.py`, `replay_recurrence`, `export_dataset` |

Hai tập không tự chạy nối tiếp. Các pha Thực tế và Toàn tập cần bấm tay. Mở hộp thoại tạm dừng; đóng giữ nguyên bước. Thanh thời gian cho phép tua để giải thích; tua lùi sẽ ẩn dự đoán và đáp án.

## Hỏi đáp

Từ Tổng kết, bấm **04 Hỏi đáp**:

> Người xem có thể hỏi bằng tiếng Việt, ví dụ “Tôi có 200 triệu, nên đầu tư như thế nào?”. Chat dùng dữ liệu mô hình và tài liệu FPT để giải thích theo câu hỏi. Mình có thể mở nguồn của câu trả lời để đối chiếu.

Chat cần API và cấu hình kết nối. Khi trả lời xong, màn hình cuộn tới đầu câu trả lời mới. Chuyển chương vẫn giữ hội thoại. **Phụ lục** luôn có trên thanh đầu trang để mở dữ liệu lịch sử, cách chia tập và mã nguồn khi được hỏi.
