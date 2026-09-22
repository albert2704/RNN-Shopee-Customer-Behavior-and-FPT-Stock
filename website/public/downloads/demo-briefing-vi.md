# Kịch bản riêng cho người phụ trách demo website và giải thích code

Kịch bản cập nhật ngày 28/09/2026 cho luồng Retailrocket → Amazon → tổng kết, dựa trên mã PyTorch và dữ liệu `public/data/demo.json`. File JSON này cung cấp cả hoạt ảnh và chỉ số toàn test của demo chính.

Tài liệu đầu vào: [Script Thuyết Trình — Recurrent Neural Network (RNN)](https://docs.google.com/document/d/1XzmpjDG1ly2LY6barHGWkF--25o2sgfc6W-s4spbvio/edit?tab=t.0). Bản đã đối chiếu có 25 slide về lý thuyết; chưa có phần demo hai tập dữ liệu. Kịch bản dưới đây nối tiếp phần đó, không thay nội dung trong Google Docs.

## 1. Mục đích phần của bạn

Sau phần lý thuyết, người xem cần nhận ra được bốn việc trên dữ liệu thật:

1. Một đầu vào `x_t` cụ thể gồm những gì.
2. Trạng thái `h_t` thay đổi ra sao, còn trọng số được giữ nguyên khi dự đoán.
3. Trạng thái cuối được đổi thành một dự báo như thế nào.
4. Dự báo được đánh giá bằng cách nào và có tốt hơn cách giữ giá trị cuối không.

Không cần giảng lại cả 25 slide. Dành khoảng 3–4 phút cho demo chính nếu chỉ dừng ngắn để giải thích; câu hỏi và mở code tính riêng. Đây là thời lượng đề xuất, không phải yêu cầu đã được nhóm xác nhận. Lời giải thích dài cần một điểm dừng có chủ đích.

Điều phải nói ngay từ đầu: **website phát lại các đầu vào, trạng thái và dự báo đã xuất từ mô hình PyTorch được huấn luyện trước. Bấm phát không chạy PyTorch, không huấn luyện và không tạo một dự báo mới trong trình duyệt.**

## 2. Chỗ cần thống nhất với người trình bày lý thuyết

| Trong tài liệu | Điều cần nói chính xác để khớp demo |
| --- | --- |
| Slide 16 mô tả `g` là Softmax/Sigmoid | Đó là các lựa chọn cho phân loại. Hai bài toán trong demo là hồi quy: dùng lớp `Linear`, không có Softmax/Sigmoid sau lớp đó. Đầu ra còn phải bỏ chuẩn hóa và đảo biến đổi. |
| Slide 17 dùng many-to-one để phân loại câu | Many-to-one là dạng quan hệ đầu vào/đầu ra, không chỉ dành cho phân loại. Demo dùng nhiều mốc lịch sử để hồi quy một giá trị ở mốc tiếp theo. |
| Slide 20 nói loss của chuỗi là tổng loss ở mọi bước | Chỉ phù hợp khi bài toán đặt đầu ra/nhãn ở những bước đó. Ở code này, một cửa sổ chỉ có một mục tiêu; MSE được lấy trung bình trên các dự báo trong batch. |
| Slide 21 mô tả tính `y_t`, `L_t` tại mọi bước | Ở demo: tính đủ các trạng thái, lấy trạng thái cuối qua Linear, rồi tính một loss cho mỗi cửa sổ. Loss ở cuối vẫn truyền gradient qua các trạng thái trước bằng BPTT. |
| Slide 25 kết thúc bằng lời cảm ơn | Người nói cuối nên chuyển lời sang demo trước khi nhóm kết thúc buổi trình bày. |

Câu nối để xử lý khác biệt many-to-many / many-to-one:

> Ở phần lý thuyết, nhóm vừa trình bày cả trường hợp có đầu ra ở nhiều bước. Trong thí nghiệm này, nhóm dùng dạng many-to-one: đọc hết cửa sổ quá khứ và chỉ dự báo một mốc tiếp theo. Vì vậy, nhóm tính loss ở đầu ra cuối; gradient vẫn truyền ngược qua toàn bộ cửa sổ.

Không gọi hàm `tanh` là phép lấy trung bình. “Zero-centered” nói về miền giá trị có cả âm và dương quanh 0; không bảo đảm trung bình của các trạng thái quan sát được đúng bằng 0. Cũng không nói mạng truyền thẳng hoàn toàn không thể dùng thứ tự: vị trí các đầu vào cố định có thể mang thông tin thứ tự; điểm khác ở đây là cơ chế trạng thái truy hồi và chia sẻ tham số.

## 3. Kịch bản demo theo màn hình

### 3.1. Trước khi bấm phát

Mở [website demo](http://127.0.0.1:4173/#demo), để ở Retailrocket và tốc độ 1×. Tải lại trang trước lượt chính để nút bắt đầu là **Chạy cả 2 demo**. Mở sẵn các file ở mục 4 trong editor, nhưng giữ website trên màn hình trình chiếu.

Người trình bày trước có thể nói:

> Phần tiếp theo, nhóm sẽ đối chiếu các khái niệm vừa trình bày với hai thí nghiệm cụ thể trên website.

Bạn nói:

> Em sẽ minh họa hai bài toán: số sự kiện giao dịch theo giờ của Retailrocket và giá cổ phiếu Amazon. Mỗi bài toán dùng một mô hình được huấn luyện riêng. Website phát lại các phép tính đã được xuất từ mô hình, để mình nhìn rõ từng bước; đây không phải quá trình học trực tiếp.
>
> Mọi người chú ý hai phần: trạng thái thay đổi khi mô hình đọc dữ liệu, và dự đoán có tốt hơn cách giữ nguyên giá trị gần nhất hay không.

Bấm **Chạy cả 2 demo**. Toàn bộ lượt chính đi theo Retailrocket → Amazon → tổng kết. Nếu cần nói kỹ cơ chế, chỉ dừng ngắn ở bước 2 của Retailrocket, sau đó tiếp tục. Không cần mở các hộp thoại trong lượt giải thích chính.

Ngay trên sơ đồ có định nghĩa: **32 là số giá trị trong trạng thái ẩn, do nhóm chọn khi tạo mô hình**. Khối RNN hiện phép tính bằng số cho ô trạng thái đầu tiên: tổng các tích từ dữ liệu mới, tổng các tích từ trạng thái trước, tổng hai độ lệch, rồi qua `tanh`. Khi đến pha dự đoán, bảng bên cạnh hiện cả phép bỏ chuẩn hóa và đổi đơn vị bằng số thật. Dùng trực tiếp các dòng đang hiện để dẫn chuyện; không cần mở hộp thoại trợ giúp.

### 3.2. Retailrocket: dùng tập đầu để giải thích cơ chế

**Khi bắt đầu đọc dữ liệu:**

> Đây là hoạt động đã tổng hợp theo giờ của một website bán hàng. Nhóm dùng 24 giờ quá khứ để dự đoán số sự kiện giao dịch trong giờ tiếp theo.
>
> Một giờ không chỉ có số giao dịch trên biểu đồ. Mạng nhận bảy giá trị: ba loại hành vi là lượt xem, thêm giỏ, giao dịch; cùng bốn giá trị biểu diễn giờ và thứ trong tuần. Các giá trị được biến đổi và chuẩn hóa trước khi vào mạng.

Chỉ bảng **Đầu vào**, rồi chỉ sơ đồ phía dưới. Nếu dừng ở bước 2:

> Nhóm chọn trạng thái có 32 giá trị khi tạo mô hình. Ban đầu cả 32 giá trị bằng 0. Ở mỗi giờ, RNN nhân dữ liệu mới và trạng thái trước với các trọng số tương ứng, cộng các tích và độ lệch, rồi qua tanh để tính 32 giá trị mới. Sang giờ thứ hai, nhóm số vừa tính được dùng làm trạng thái trước.
>
> Đây là ý nghĩa của mũi tên truyền trạng thái. Cùng một bộ trọng số được dùng ở các bước. Các ô màu là giá trị số của trạng thái, không phải mỗi ô được đặt tên sẵn là xu hướng hay thói quen khách hàng.

Nếu giảng viên chỉ vào bảng đầu vào ở giờ đầu: **361 lượt xem, 3 thêm giỏ, 0 giao dịch**. Số 0 trên đường giao dịch không có nghĩa cả vector đầu vào bằng 0. Bảng hiển thị số đếm dễ đọc; đầu vào mạng đã qua `log1p` và chuẩn hóa.

**Khi chạy tiếp từ bước 3:**

> Các giờ còn lại lặp lại cùng phép tính. Website bỏ chuyển động truyền trạng thái từ bước 3 để dễ theo dõi; mô hình vẫn xử lý đủ 24 giờ.

**Khi hiện dự đoán:**

> Đọc đủ 24 giờ, nhóm lấy trạng thái cuối qua lớp Linear. Mỗi giá trị trạng thái được nhân với một trọng số; cộng 32 tích rồi thêm độ lệch sẽ tạo một số đã chuẩn hóa. Sau khi đổi về đơn vị gốc, dự báo là khoảng 1,16 sự kiện giao dịch.

Đầu ra chuẩn hóa của mẫu này là khoảng −0,8521; đó chưa phải số sự kiện âm. Bỏ chuẩn hóa rồi hoàn tác log mới có dự báo 1,16.

**Khi hiện thực tế:**

> Thực tế là 13 sự kiện. Dự báo này thấp hơn nhiều; mô hình đã bỏ lỡ mức tăng. Nhóm vẫn hiển thị mẫu này vì đây là mẫu test đầu tiên theo thời gian, không chọn mẫu đẹp nhất.

**Khi hiện MAE toàn tập:**

> Một trường hợp chưa đủ đánh giá mô hình. Trên 491 dự báo kiểm tra, MAE của RNN là khoảng 2,51 sự kiện, còn cách giữ giá trị giờ trước là 3,46. Trong lần thí nghiệm này, RNN tốt hơn cách đối chứng trên toàn tập, dù mẫu vừa xem vẫn sai khá nhiều.

### 3.3. Amazon: dùng tập thứ hai để giải thích cách đánh giá

> Với Amazon, một bước là một phiên giao dịch. Mạng nhận 30 lợi suất log đã chuẩn hóa, mỗi phiên một giá trị. Đường trên biểu đồ là giá USD để người xem dễ đọc, còn đầu vào thực tế của mô hình là mức thay đổi giá theo log.
>
> RNN dự đoán lợi suất phiên tiếp theo. Nhóm đổi kết quả về giá bằng giá phiên cuối nhân với exp của lợi suất dự báo.

Khi so mẫu: RNN khoảng **88,55 USD**, thực tế **89,53 USD**, giữ giá trước khoảng **88,46 USD**.

> Ở mẫu này, RNN gần thực tế hơn một chút. Nhưng MAE trên 999 phiên test là khoảng 2,269 USD, cao hơn 2,262 USD của cách giữ giá cũ. Vì vậy, nhóm chưa có bằng chứng RNN tốt hơn cách đơn giản đó trên tập này.

Đây là điểm mạnh của cách trình bày: không dùng một mẫu đẹp để khẳng định mô hình tốt. Không gọi giá điều chỉnh hồi cứu là dữ liệu giao dịch thời gian thực.

### 3.4. Khi website dừng ở tổng kết

> Cả hai bài toán đều đọc dữ liệu theo thứ tự, cập nhật trạng thái rồi dự báo từ trạng thái cuối. Hiệu quả phụ thuộc dữ liệu: RNN cải thiện MAE ở Retailrocket, nhưng chưa vượt cách giữ giá ở Amazon trong lần thực nghiệm này.
>
> Nhóm đánh giá trên dữ liệu kiểm tra và so với một phương pháp đơn giản. Các chỉ số có đơn vị khác nhau nên không dùng độ lớn MAE để xếp hạng hai tập với nhau.

Sau đó chuyển sang câu hỏi. Chỉ mở code khi cần chứng minh một điểm cụ thể.

### 3.5. Giải thích trực tiếp trên màn hình

Nếu cần nói kỹ một phép tính, bấm **Tạm dừng** và chỉ ngay vào số đang hiện:

| Giảng viên chỉ vào | Vị trí trên màn hình | Nội dung để trả lời |
| --- | --- | --- |
| “32 là gì?” | Dòng định nghĩa và các ô trạng thái | Nhóm chọn `hidden_size=32`. Cả 32 giá trị được tính lại sau mỗi bước; 7/1 là số đặc trưng, 24/30 là độ dài chuỗi. |
| “Khối RNN thực sự tính gì?” | Phép tính ô 1 trong khối RNN | Dữ liệu mới và trạng thái trước được nhân với các trọng số tương ứng. Cộng các tích và hai độ lệch đã học, rồi qua tanh để ra giá trị mới của ô 1. 31 ô còn lại dùng cùng công thức với các hàng trọng số riêng. |
| “Linear biến trạng thái thành dự đoán thế nào?” | Khối đầu ra và bảng ở pha Dự đoán | 32 tích cộng một bias tạo số chuẩn hóa; phép tính bên cạnh bỏ chuẩn hóa bằng thống kê train, rồi đổi về số sự kiện hoặc USD. |

Trọng số là hệ số nhân, độ lệch là số cộng thêm; cả hai được học khi huấn luyện và giữ nguyên trong lượt dự đoán. Các phép tính bằng số xuất hiện theo tiến trình: chưa đọc đầu vào thì chưa có ví dụ tính trạng thái, chưa đến pha **Dự đoán** thì chưa hiện các số của dự báo cuối. Tua lùi sẽ ẩn lại đầu ra. Sau câu trả lời, bấm **Tiếp tục** để chạy từ đúng vị trí; không cần chuyển trang hoặc mở trợ giúp.

## 4. Mở code khi bị hỏi

Mở sẵn sáu file Python: `../models/src/models.py`, `../models/src/training.py`, `../models/src/preprocessing.py`, `../models/src/evaluation.py`, `../models/src/config.py`, `scripts/export_demo.py`. Có thể dùng [CODE_MAP_VI.md](../../../models/CODE_MAP_VI.md) để tìm thêm. Số dòng dưới đây ứng với bản đã đối chiếu; tên hàm/từ khóa giúp tìm lại nếu số dòng thay đổi.

| Giảng viên hỏi | Mở file / dòng | Chỉ vào đâu và trả lời gì |
| --- | --- | --- |
| “Mạng RNN nằm ở đâu?” | [models.py](../../../models/src/models.py), dòng 14–33 | `self.recurrent` khai báo mạng; `nn.Linear(hidden_size, 1)` tạo đầu ra; `forward` đọc chuỗi và lấy trạng thái cuối. |
| “Công thức tanh trên slide ở đâu trong code?” | [export_demo.py](../../scripts/export_demo.py), hàm `replay_recurrence` | Đầu vào nhân ma trận + trạng thái trước nhân ma trận + hai bias, rồi `torch.tanh`. Đây là hàm đối chiếu lượt thuận với PyTorch, không phải vòng huấn luyện thay thế. |
| “Các phép nhân của ô 1 trên website từ đâu?” | Cùng file, hàm `trace_first_component`; [RecurrentMechanism.tsx](../../src/components/demo/RecurrentMechanism.tsx) | Script lấy hàng 0 của hai ma trận trọng số thật và trạng thái trước từ PyTorch, xuất từng tích, hai bias, tổng và kết quả tanh. Ô 1 là `h[0]`. Component trình bày các tổng và phép tanh ngay trong sơ đồ; mô hình vẫn tính đủ 32 ô. |
| “Phép bỏ chuẩn hóa có phải số minh họa?” | [export_demo.py](../../scripts/export_demo.py), hàm `export_dataset`, tìm `output_weights`, `normalization`; [PredictionReadout.tsx](../../src/components/demo/PredictionReadout.tsx) | Xuất đủ trọng số/bias của Linear và trung bình, độ lệch chuẩn mục tiêu từ manifest; đối chiếu đầu ra với PyTorch. Bảng dự đoán dùng các số thật để trình bày từ đầu ra chuẩn hóa đến đơn vị gốc sau khi đã đến pha Dự đoán. |
| “Tại sao hai bias trong code mà slide chỉ có một?” | Cùng hàm `replay_recurrence`, tìm `bias_ih_l0` | PyTorch lưu `bias_ih_l0` và `bias_hh_l0`; trong công thức gộp có thể viết tổng của chúng thành `b`. |
| “24 giờ hoặc 30 phiên được cắt ở đâu?” | [preprocessing.py](../../../models/src/preprocessing.py), dòng 206–209 | `scaled_x[t-lookback:t]` lấy quá khứ, bỏ cận phải `t`; `y` lấy tại `t`. |
| “Đầu vào Retailrocket thật sự có gì?” | Cùng file, dòng 45–64 | Ba số đếm qua `log1p`, bốn đặc trưng thời gian sin/cos; thứ tự bảy cột được ghi rõ trong `features`. |
| “Amazon có nhận trực tiếp giá không?” | Cùng file, dòng 132–136; tìm `return frame, ["log_return"]` | `np.log(frame.target / frame.target.shift(1))` tạo lợi suất log; danh sách đầu vào chỉ có `log_return`. |
| “Chia dữ liệu và chuẩn hóa có nhìn tương lai không?” | Cùng file, dòng 182–209 | Chia theo thời điểm mục tiêu; thống kê x/y chỉ lấy từ train. Sau đó dùng lại cho validation/test; từng cửa sổ vẫn kết thúc trước nhãn. |
| “Học trọng số ở dòng nào?” | [training.py](../../../models/src/training.py), dòng 59–68 | `zero_grad` xóa gradient cũ; `loss_fn(model(x), y)` tính dự đoán và loss; `backward` tính gradient; clipping giới hạn norm; `optimizer.step` mới cập nhật trọng số. |
| “Chọn mô hình bằng test à?” | Cùng file, dòng 71–91 | Dùng validation MSE để lưu `best_state`, dừng sớm và khôi phục checkpoint tốt nhất. Test không tham gia chọn epoch. |
| “Đầu ra Linear đổi thành giá/số sự kiện ở đâu?” | [evaluation.py](../../../models/src/evaluation.py), dòng 23–37 | `original_units`: bỏ chuẩn hóa; Retail dùng `expm1` và chặn âm; Amazon dùng giá cuối × `exp(return)`. |
| “Sai số này tính như thế nào?” | [evaluation.py](../../../models/src/evaluation.py), dòng 40–48 | Hiệu dự báo − thực tế; MAE lấy trung bình trị tuyệt đối sau khi đổi về đơn vị gốc. Baseline giữ nguyên được tạo ở dòng 97–108. |
| “Website có thực sự chạy mô hình không?” | [useDemoData.ts](../../src/hooks/useDemoData.ts), tìm `fetch`; [export_demo.py](../../scripts/export_demo.py), hàm `load_checkpoint` và `predict_saved_windows` | Browser đọc `demo.json`. Script Python nạp checkpoint và suy luận trước khi xuất; browser phát lại dữ liệu đó. |
| “Làm sao biết các ô màu không phải số tự đặt?” | [export_demo.py](../../scripts/export_demo.py), hàm `export_dataset` | Kiểm tra hash checkpoint, khớp đầu vào chuẩn hóa, chạy lại mô hình, đối chiếu từng trạng thái và dự báo. Kiểm tra số liệu mới chứng minh nguồn của hình; màu chỉ là cách hiển thị. |

## 5. Hai đoạn code phải tự giải thích được

### 5.1. Đầu vào → trạng thái cuối → dự đoán

Đoạn trích từ `models.py`:

```python
sequence, hidden = self.recurrent(x)
return self.output(sequence[:, -1, :])
```

Cách đọc với Retailrocket, một batch đầy đủ:

1. `x` có dạng `(64, 24, 7)`: 64 cửa sổ, mỗi cửa sổ 24 giờ, mỗi giờ 7 đặc trưng. Batch cuối có thể ít hơn 64.
2. `sequence` có dạng `(64, 24, 32)`: lưu trạng thái ở cả 24 bước, mỗi trạng thái gồm 32 số.
3. `sequence[:, -1, :]` nghĩa là lấy mọi cửa sổ, bước thời gian cuối, mọi thành phần trạng thái. Kết quả `(64, 32)`.
4. `self.output` là Linear từ 32 thành 1; kết quả `(64, 1)`. Mỗi cửa sổ có một dự báo đã chuẩn hóa.

Câu trả lời nói được trong khoảng 20 giây:

> Dòng đầu cho RNN đọc toàn bộ chuỗi và trả trạng thái theo từng bước. Dòng thứ hai lấy trạng thái cuối của mỗi cửa sổ, đưa qua Linear để tạo một dự báo. 32 là số thành phần trạng thái, còn 24 là độ dài chuỗi; hai con số có vai trò khác nhau.

`hidden` ở cấu hình một lớp, một chiều có dạng `(1, B, 32)` và chứa trạng thái cuối. Code hiện dùng `sequence[:, -1, :]`; không đưa trực tiếp toàn bộ `sequence` qua lớp dự đoán ở mọi bước. Không truyền `h0` vào lời gọi RNN thì PyTorch dùng trạng thái 0. Trong cách triển khai này, mỗi cửa sổ độc lập bắt đầu lại từ 0. Xem [tài liệu nn.RNN](https://docs.pytorch.org/docs/stable/generated/torch.nn.RNN.html).

### 5.2. Tính gradient khác với cập nhật trọng số

Đoạn trích từ `training.py`:

```python
optimizer.zero_grad(set_to_none=True)
loss = loss_fn(model(x), y)
loss.backward()
nn.utils.clip_grad_norm_(model.parameters(), config["gradient_clip_norm"])
optimizer.step()
```

Câu trả lời:

> Mô hình dự đoán, rồi so với nhãn để tính loss. `backward` tính xem loss thay đổi theo từng tham số như thế nào; nó chưa sửa trọng số. Sau khi giới hạn norm gradient, `optimizer.step` dùng Adam để cập nhật tham số. Quá trình đó lặp qua các batch và epoch.

Trong bài này, `nn.MSELoss()` dùng phép lấy trung bình. Mỗi cửa sổ có một đầu ra, nên loss của batch là trung bình bình phương sai số của các đầu ra đó, ở thang đã biến đổi và chuẩn hóa. Nó không phải MAE theo đơn vị gốc và không phải tổng 24 loss ở 24 giờ. Xem [tài liệu MSELoss](https://docs.pytorch.org/docs/stable/generated/torch.nn.MSELoss.html).

## 6. Câu hỏi phụ dễ bị hỏi tiếp

**Vì sao 32, 24 và 30?**

32 là hidden size đã chọn; 24 giờ và 30 phiên là độ dài cửa sổ đã chọn cho thí nghiệm. 24 giờ bao phủ một ngày, 30 phiên bao phủ nhiều tuần giao dịch. Đây là lý do chọn cấu hình để thử nghiệm, không phải chứng minh tối ưu. Nhóm chưa có phép so sánh có kiểm soát giữa nhiều hidden size/lookback để kết luận các số này tốt nhất.

**Mỗi ô màu là một neuron hay một giờ?**

Mỗi ô là một thành phần của vector trạng thái tại một bước. Cả 32 ô được cập nhật sau mỗi giờ/phiên; không phải mỗi ô lưu riêng một giờ. Màu biểu diễn dấu và độ lớn của số, không có ý nghĩa nghiệp vụ được xác nhận cho từng ô.

**Vì sao dự đoán 1,16 giao dịch, trong khi số sự kiện phải nguyên?**

Mô hình đang làm hồi quy nên trả một ước lượng liên tục. Dữ liệu thực là số đếm nguyên. Website giữ giá trị chưa làm tròn thành số nguyên để phản ánh đúng đầu ra và phép đánh giá. Với biến đổi log rồi lấy mũ, không tự khẳng định đây là kỳ vọng số đếm không chệch.

**Có phải đọc thêm một giờ là học thêm không?**

Không. Khi suy luận, đầu vào mới làm trạng thái thay đổi, trọng số giữ nguyên. Huấn luyện cần nhãn, loss, gradient và bước cập nhật tham số. Ở website, ngay cả quá trình suy luận đã được tính trước; hoạt ảnh chỉ thay đổi phần kết quả được hiển thị.

**Một loss ở cuối thì làm sao học từ đầu chuỗi?**

Đầu ra phụ thuộc trạng thái cuối; trạng thái cuối lại phụ thuộc các trạng thái trước. Autograd đi ngược các quan hệ phụ thuộc đó. Vì tham số được dùng chung, gradient của một tham số nhận đóng góp từ nhiều lần tham số đó được dùng trong chuỗi.

**Sao train dùng shuffle mà lại nói không đảo chuỗi?**

`DataLoader` xáo thứ tự các cửa sổ thuộc train. Các giờ bên trong một cửa sổ vẫn giữ đúng thứ tự; train, validation, test đã chia theo thời gian trước đó.

**Có dùng quan sát thuộc test làm đầu vào không?**

Có thể dùng quan sát test đã xảy ra trước mục tiêu hiện tại. Đây là dự báo một bước cuốn chiếu: đến thời điểm mới, lịch sử mới đã biết. Không dùng nhãn hiện tại hay tương lai; cũng không nói đây là dự báo cả nhiều tháng chỉ từ dữ liệu ở đầu kỳ test.

**Hai tập dùng chung một bộ trọng số à?**

Không. Chúng dùng cùng loại kiến trúc, mỗi tập được huấn luyện riêng. Chia sẻ trọng số ở đây là giữa các bước thời gian trong cùng một mô hình. Số đặc trưng của Retailrocket là 7, của Amazon là 1.

**Tại sao không dùng GRU/LSTM?**

Demo chính nhằm giải thích RNN cơ bản. Thực nghiệm còn có GRU để so sánh. Không có kết quả LSTM trong phần này; không khẳng định LSTM sẽ tốt hơn nếu chưa thử trên cùng cách chia và đánh giá.

**Nếu Amazon không tốt hơn baseline thì mô hình sai?**

Không nhất thiết sai về cài đặt. Nó cho thấy cấu hình/thực nghiệm hiện tại chưa đem lại lợi thế dự báo theo chỉ số đang so. Không dùng kết quả đó để kết luận mọi RNN đều thất bại hoặc tự nhận ra nguyên nhân cụ thể khi chưa có thí nghiệm kiểm chứng.

## 7. Cách xử lý khi bị ngắt để hỏi code

1. Bấm **Tạm dừng** trước khi đổi cửa sổ. Nút này rõ ràng hơn Space nếu focus đang ở thanh trượt hoặc nút khác.
2. Trả lời ý nghĩa bằng một câu, rồi mở đúng file chứng minh câu đó.
3. Chỉ giải thích đoạn liên quan, thường 2–10 dòng. Chỉ rõ tensor vào, phép xử lý và tensor ra nếu được hỏi về mô hình.
4. Quay lại website và bấm **Tiếp tục**. Không chạy lại cả hai tập chỉ vì vừa mở code.

Nếu được yêu cầu chỉ nơi BPTT xảy ra, mở `loss.backward()` trước. Nếu được hỏi công thức truy hồi cho cả vector, mở `replay_recurrence`; nếu hỏi nguồn từng phép nhân của ô 1 trên website, mở `trace_first_component`. `RecurrentMechanism.tsx` trình bày phép tính trạng thái; `PredictionReadout.tsx` trình bày phép đổi đầu ra về đơn vị gốc; `useDemoPlayback.ts` điều khiển việc phát. Chọn đúng tầng mã giúp tránh giải thích giao diện khi câu hỏi đang hỏi thuật toán học.

Nếu chưa có bằng chứng cho một câu hỏi, trả lời giới hạn cụ thể:

> Ở phiên bản này, nhóm chưa làm phép so sánh đó. Em có thể chỉ ra cấu hình đang dùng và kết quả hiện có, nhưng chưa kết luận phương án kia sẽ tốt hơn.

## 8. Tập trước buổi trình bày

- Chạy một lượt chỉ nói các đoạn chính ở mục 3; thử trên đúng màn hình và mức zoom sẽ dùng.
- Nhờ một người ngắt ở bước 2 và hỏi “32 ô là gì?”; dừng rồi tiếp tục đúng vị trí.
- Tập mở `models.py` và giải thích hai dòng forward mà không đọc nguyên chú thích.
- Tập mở `training.py` và phân biệt `backward` với `step`.
- Tập chứng minh `x[t-lookback:t]` không chứa nhãn tại `t`.
- Tập câu kết luận Amazon: mẫu đang xem tốt hơn, nhưng toàn test chưa tốt hơn baseline.

Tra cứu đầy đủ hơn: [bản đồ code](../../../models/CODE_MAP_VI.md) và [hướng dẫn điều khiển demo](../../PRESENTATION_GUIDE.md). Không cần chạy lại huấn luyện trong buổi nói để chứng minh mô hình có thật; có thể mở checkpoint, script xuất và các phép đối chiếu đã lưu.
