# Hướng dẫn demo sau phần thuyết trình

Hoàn thành phần slide rồi mở [website](http://127.0.0.1:4173/#demo). Bấm **Chạy cả 2 demo**. Website tự chạy Retailrocket → Amazon → tổng kết. Không cần cuộn hoặc chuyển sang trang khác trong lượt demo chính.

## Chuẩn bị

Kiểm tra trên chính màn hình và mức zoom sẽ dùng khi trình chiếu. Có thể bật toàn màn hình để biểu đồ dễ nhìn hơn. Chạy thử cả hai tập trước buổi nói, sau đó tải lại để trở về đầu.

Dữ liệu, font và tài liệu có sẵn trên máy. Các liên kết nguồn bên ngoài mới cần Internet. Hoạt ảnh phát lại mô hình đã được huấn luyện; máy không phải huấn luyện lại trong buổi trình bày.

## Mở đầu

> Phần vừa rồi đã giải thích cách RNN hoạt động. Bây giờ nhóm sẽ cho mô hình đọc dữ liệu thật trên hai bài toán. Mọi người chú ý hai việc: trạng thái thay đổi khi đọc chuỗi, và kết quả có tốt hơn cách đoán đơn giản hay không.

Bấm **Chạy cả 2 demo**. Biểu đồ giữ nguyên vị trí, còn bảng bên cạnh lần lượt giải thích bước đang đọc, dự đoán, thực tế kèm nhận xét ví dụ, rồi MAE trên toàn tập kiểm tra. Có thể để toàn bộ lượt chạy tự động, hoặc tạm dừng bằng **Space** khi cần nói thêm.

Ở tốc độ 1×, mỗi tập mở đầu trong 1,2 giây. Hai bước đầu dừng 4,4 giây mỗi bước để chỉ rõ **trạng thái trước + đầu vào hiện tại → RNN → trạng thái mới**; mũi tên vòng cho thấy trạng thái mới được đưa sang bước sau. Từ bước 3, bỏ chuyển động truyền vector và đổi pha nhấn sáng; biểu đồ và giá trị tiếp tục cập nhật mỗi 0,7 giây. Đầu vào cuối giữ 1,5 giây trước khi hiện dự đoán. Sau đó có 2,6 giây cho dự đoán, 5 giây cho thực tế và nhận xét, 7 giây cho MAE trước khi tự chuyển tiếp. Có thể tạm dừng nếu cần nói dài hơn.

## 1. Retailrocket

> Đầu tiên là dữ liệu hành vi trên một website bán hàng. Nhóm tổng hợp số lượt xem, thêm giỏ và sự kiện giao dịch theo từng giờ. Mục tiêu là dự đoán số sự kiện giao dịch trong giờ tiếp theo.
>
> Mô hình đọc 24 giờ đã quan sát. Ở mỗi bước, dữ liệu giờ hiện tại và trạng thái trước được dùng để tính trạng thái mới. Trạng thái mới tiếp tục được đưa sang bước sau.

Chỉ vào dấu đang chạy trên biểu đồ, hai khối trạng thái và mũi tên vòng. Ở bước đầu, trạng thái trước là 32 số 0; sang bước hai, trạng thái mới vừa tính trở thành trạng thái trước. Đây là cách khởi tạo theo từng cửa sổ của thí nghiệm này, không phải quy tắc bắt buộc với mọi RNN.

Đọc định nghĩa có sẵn dưới sơ đồ: **32 là số giá trị trong trạng thái ẩn, do nhóm chọn khi tạo mô hình**. Mỗi ô màu biểu diễn một giá trị. Khối RNN hiện phép tính thật của ô 1: tổng các tích từ dữ liệu mới, tổng các tích từ trạng thái trước, cộng hai độ lệch đã học, rồi qua `tanh`. 31 ô còn lại dùng cùng công thức với các hàng trọng số riêng. Trọng số là hệ số nhân; độ lệch là số cộng thêm. Chúng giữ nguyên khi dự đoán.

Đọc đủ chuỗi mới dùng Linear: nhân 32 giá trị trạng thái cuối với 32 trọng số, cộng các tích và một độ lệch để tạo một số đã chuẩn hóa. Bảng dự đoán hiện phép bỏ chuẩn hóa và đổi về đơn vị gốc bằng số thật. Giải thích trực tiếp trên màn hình, không cần mở trợ giúp; có thể tạm dừng nếu muốn người xem đọc kỹ một phép tính.

Nếu được hỏi đầu vào, nói mô hình có bảy giá trị ở mỗi giờ: ba số đếm sự kiện qua `log1p` và bốn giá trị sin/cos biểu diễn giờ, thứ trong tuần; cả bảy được chuẩn hóa bằng thống kê train. Không cần mở hộp thoại để nói hết các chi tiết này trong lượt chạy chính.

Khi dự đoán và thực tế tự hiện, đọc các số đang hiển thị thay vì ghi nhớ một kết quả mẫu trong hướng dẫn.

> Trong giờ này, thực tế là 13 sự kiện giao dịch nhưng RNN dự đoán khoảng 1,16. Mô hình vẫn bỏ lỡ mức tăng này.

Khi bảng bên cạnh chuyển sang đánh giá toàn tập:

> MAE là độ lệch tuyệt đối trung bình trên toàn tập kiểm tra. Trên tập này, RNN có MAE thấp hơn cách lấy số giao dịch của giờ trước làm dự đoán, dù ví dụ vừa xem vẫn lệch khá nhiều.

Không gọi sự kiện giao dịch là số đơn hàng. Đây là dữ liệu tổng hợp, không phải dự đoán một khách hàng cụ thể sẽ mua gì.

## 2. Amazon

Website tự chuyển sang Amazon. Giữ cách quan sát giống tập trước.

> Với Amazon, một bước là một phiên giao dịch. Mô hình đọc 30 phiên thay đổi giá, được biểu diễn bằng lợi suất log. Sau khi dự đoán lợi suất phiên tới, nhóm đổi kết quả về giá đóng cửa điều chỉnh để dễ đối chiếu.
>
> Biểu đồ giá giúp mình nhìn diễn biến. Nó không có nghĩa mô hình được đưa trực tiếp 30 giá gốc vào.

Khi kết quả xuất hiện:

> Ở phiên này, dự đoán của RNN gần thực tế hơn một chút so với việc lấy giá phiên trước. Nhưng khi nhìn MAE trên toàn tập kiểm tra, RNN vẫn chưa tốt hơn cách đơn giản đó. Một ví dụ tốt chưa chứng minh cả mô hình tốt.

Chỉ nói thêm về GRU nếu được hỏi hoặc mở phân tích đầy đủ: GRU giảm MAE rất ít nhưng RMSE lại cao hơn, nên chưa có lợi thế nhất quán.

Không dùng demo này để khẳng định khả năng kiếm lời. Thí nghiệm chưa đánh giá chiến lược hoặc chi phí giao dịch.

## 3. Tổng kết

Lượt chạy dừng ở tổng kết để nhóm kết luận.

> Cả hai bài toán dùng cùng nguyên tắc: đọc dữ liệu theo thứ tự, cập nhật trạng thái, rồi dự đoán từ trạng thái cuối. Nhưng hiệu quả khác nhau theo dữ liệu. Trong thí nghiệm này, RNN cải thiện MAE trên Retailrocket; với Amazon thì chưa tốt hơn cách giữ nguyên giá.
>
> Vì vậy, nhóm không chỉ xem một hoạt ảnh hoặc một dự đoán đẹp. Nhóm đánh giá trên dữ liệu kiểm tra và luôn so với một cách dự báo đơn giản.

Không so trực tiếp các con số MAE giữa hai tập: đơn vị khác nhau. Kết quả thuộc một lần huấn luyện và một cách chia dữ liệu.

## Điều khiển khi bị hỏi ngắt

- **Tạm dừng / Tiếp tục** hoặc **Space:** dừng cả hoạt ảnh và việc tự chuyển tập. Khi đang chọn một nút, thanh trượt hoặc ô nhập, dùng đúng thao tác bàn phím của điều khiển đó.
- **Thanh thời gian:** chọn một bước để giải thích; thao tác này tạm dừng. Kéo về trước đầu ra sẽ ẩn lại dự đoán và đáp án.
- **Tab dữ liệu:** chọn một tập cụ thể, trở về đầu tập đó và tạm dừng. Bấm **Chạy tập này** để chạy riêng tập đã chọn.
- **Tốc độ:** chọn 0,5×, 1× hoặc 2×. **Chạy lại tập này** xuất hiện khi một lượt chạy riêng đã kết thúc; nút biểu tượng **Chạy lại cả 2 từ đầu** luôn bắt đầu lại cả chuỗi. **Tổng kết** cho phép mở kết quả chung ngay khi cần.
- **Giải thích nhanh:** chọn **Trạng thái, Trọng số, Huấn luyện** hoặc **Đầu vào** để trả lời đúng chủ đề đang hỏi. Mỗi chủ đề có một lời giải thích ngắn kèm hình. Phần đầu vào dùng đúng tập đang xem. **Đọc giải thích đầy đủ** mở tài liệu tham khảo dài hơn nếu cần.
- Phép tính RNN nằm ngay trong sơ đồ; phép đổi đơn vị nằm ngay bảng dự đoán. Số của dự báo cuối chỉ hiện khi đến pha **Dự đoán** và ẩn lại nếu tua lùi. Không cần bấm mở trợ giúp để giải thích hai phần này.
- Mở hộp thoại sẽ tạm dừng. Đóng hộp thoại quay về đúng tập và bước cũ, vẫn đang dừng; bấm **Tiếp tục** khi sẵn sàng.
- **Dữ liệu & phép tính:** xem dữ liệu đầu vào, trạng thái hoặc công thức. Phân tích chi tiết và mã nguồn là phụ lục tùy chọn, không phải bước tiếp theo bắt buộc của demo.

## Những câu cần trả lời rõ

**Đây có phải mô hình đang học không?**

Không. Hai mô hình thật đã học xong; hoạt ảnh chính phát lại tính toán từ checkpoint. Trong một lượt dự đoán, trọng số giữ nguyên, trạng thái thay đổi sau mỗi bước. Chủ đề **Huấn luyện** trong **Giải thích nhanh** tính một lần cập nhật SGD của mô hình minh họa riêng.

**Ví dụ “Huấn luyện” tính những gì?**

Nó dùng chuỗi ba bước [0,20; −0,10; 0,40], một giá trị trạng thái và đáp án 0,300. Dự đoán ban đầu khoảng 0,470; loss = ½(dự đoán − đáp án)² ≈ 0,014445. Gradient là đạo hàm của loss theo từng tham số. Với tốc độ học 0,1, wₓ đổi từ 0,5 thành 0,492691. Cả năm tham số đều được cập nhật, dù màn hình chỉ trình bày phép tính cho wₓ. Chạy lại cùng chuỗi từ h₀ = 0 cho dự đoán khoảng 0,351, loss ≈ 0,001323. Những số này không phải kết quả của hai mô hình trạng thái 32 chiều.

**Mỗi tập có dùng cùng một mô hình không?**

Chúng dùng cùng loại kiến trúc RNN, nhưng mỗi tập được huấn luyện riêng với số đầu vào và cửa sổ phù hợp. Retailrocket: 24 × 7; Amazon: 30 × 1. Cả hai có trạng thái 32 chiều.

**RNN có nhớ toàn bộ dữ liệu trước không?**

Không. Trạng thái là 32 giá trị được cập nhật, không phải bản sao của toàn chuỗi. Một cửa sổ mới trong thí nghiệm bắt đầu với trạng thái bằng 0; đây là cách triển khai ở bài này, không phải đặc điểm bắt buộc của mọi RNN. Không có ý nghĩa được xác nhận riêng cho từng ô như “nhớ xu hướng”.

**Có dùng thông tin tương lai không?**

Dữ liệu được chia theo thời gian; chỉ tập học được dùng để tính tham số chuẩn hóa. Mỗi dự báo dùng lịch sử đã quan sát đứng trước mục tiêu. Đây là dự báo từng bước, không phải tự dự báo nhiều tháng tương lai từ một điểm xuất phát.

**Tại sao cần cách giữ nguyên giá trị trước?**

Đó là mốc so sánh đơn giản. Nếu RNN không tốt hơn mốc này trên tập kiểm tra, độ phức tạp của mô hình chưa mang lại lợi ích rõ ràng trong thí nghiệm.

## Nguồn và số liệu

Demo chính đọc cả dữ liệu hoạt ảnh lẫn chỉ số toàn test từ `public/data/demo.json`, xuất bằng `scripts/export_demo.py` từ checkpoint thật và các kết quả đã lưu. Đọc số của từng mẫu trực tiếp trong demo; không thay bằng số minh họa. `public/data/retailrocket.json` và `public/data/amazon.json` phục vụ phần phân tích chi tiết.

Khi cần mở code chứng minh phép tính: `replay_recurrence` tính lại toàn vector trạng thái để đối chiếu PyTorch; `trace_first_component` xuất riêng từng tích của hàng 0 để giải thích ô 1. JSON còn chứa hàng trọng số đó, đủ trọng số/bias đầu ra Linear và thống kê chuẩn hóa mục tiêu từ train. `components/demo/RecurrentMechanism.tsx` trình bày phép tính trạng thái ngay trong sơ đồ; `PredictionReadout.tsx` trình bày phép bỏ chuẩn hóa và đổi đơn vị khi đến pha Dự đoán. Website không học thêm khi phát các phép tính này.

| Tập dữ liệu | Số mục tiêu test | MAE RNN | MAE giữ nguyên | Đơn vị |
|---|---:|---:|---:|---|
| Retailrocket | 491 | 2,512 | 3,458 | Sự kiện giao dịch / giờ |
| Amazon | 999 | 2,269 | 2,262 | USD / cổ phiếu điều chỉnh |

Retailrocket tổng hợp theo giờ UTC. Amazon dùng phiên giao dịch và giá điều chỉnh hồi cứu.

Nguồn: [Retailrocket](https://www.kaggle.com/datasets/retailrocket/ecommerce-dataset), [Amazon](https://www.kaggle.com/datasets/henryshan/amazon-com-inc-amzn). Kịch bản theo phần lý thuyết và câu hỏi mở code nằm trong [DEMO_BRIEFING_VI.md](../../DEMO_BRIEFING_VI.md).
