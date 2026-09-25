# Bản đồ code để trình bày và trả lời câu hỏi A6

Bản đồ này dành cho demo **Shopee Thailand (mô phỏng) và FPT**. Mỗi tập có một RNN và một GRU được huấn luyện riêng: tổng cộng bốn mạng; hoạt ảnh chính phát lại hai RNN.

## Phần 5 — Slide 20–25

Dùng trực tiếp các hàm hiện có:

| Slide | File → hàm / từ khóa | Đoạn cần chỉ và giải thích |
| --- | --- | --- |
| **20. Loss functions** | [training.py](src/training.py) → `fit_model`, `nn.MSELoss()` | MSE so dự đoán với nhãn đã biến đổi và chuẩn hóa; lấy trung bình trên batch. Cross-entropy trong lời thoại là kiến thức phân loại, không được dùng trong hai bài toán hồi quy A6. |
| **21. Training loop** | [training.py](src/training.py) → `fit_model`, vòng `for epoch`; [models.py](src/models.py) → `forward` | `zero_grad` → forward và loss → `backward` → clipping → `optimizer.step`. RNN bắt đầu mỗi cửa sổ với `h0 = 0`; Adam cập nhật sau mỗi batch. Validation chọn checkpoint. |
| **22. BPTT** | [toy_rnn.py](src/toy_rnn.py) → `manual_bptt`; [training.py](src/training.py) → `loss.backward()` | Ví dụ tính tay đi ngược các trạng thái, nhân đạo hàm tanh và cộng đóng góp vào trọng số dùng chung. Trong huấn luyện thật, autograd làm việc đó qua `backward()`. Hàm `run()` đối chiếu BPTT thủ công với autograd và sai phân hữu hạn. |
| **23. Vanishing / exploding gradients** | [toy_rnn.py](src/toy_rnn.py) → `manual_bptt`; [training.py](src/training.py) → `clip_grad_norm_` | Chỉ các phép nhân lặp lại của gradient, rồi chỉ clipping trước cập nhật. Clipping hạn chế gradient lớn, không khôi phục gradient đã biến mất. Ví dụ ba bước giải thích cơ chế; không phải thí nghiệm chứng minh các checkpoint đang vanishing/exploding. |
| **24. Khai triển toán học** | [toy_rnn.py](src/toy_rnn.py) → `da = dh * (1 - row["h"] ** 2)` và `dh = da * params["wh"]` | Mỗi bước nhân gradient với `(1 - h_t²) * wh`; nhiều bước tạo một tích các đạo hàm. Với trạng thái vector, xét tích Jacobian `diag(1 - h_t²) W_h`, không kết luận chỉ từ từng phần tử trọng số nhỏ/lớn hơn 1. |
| **25. Tổng kết / LSTM tiếp theo** | [models.py](src/models.py) → `RecurrentForecaster.__init__` | Không cần code mới. A6 hiện có RNN và GRU; LSTM là chủ đề tiếp theo, chưa có kết quả thực nghiệm trong repository. |

**Điều chỉnh lời thoại slide 20–21:** A6 lấy trạng thái cuối để dự báo một giá trị cho mỗi cửa sổ, nên có một loss đầu ra cho mỗi cửa sổ rồi lấy trung bình trong batch. Công thức cộng loss ở mọi timestep phù hợp với bài toán có nhãn ở nhiều timestep, không phải cách A6 đang tính loss. Một loss cuối chuỗi vẫn lan truyền gradient qua mọi bước.

**Phân biệt ví dụ và thực nghiệm:** `toy_rnn.py` dùng một trạng thái scalar, loss `½(ŷ−y)²` và một bước SGD để dễ tính tay. `training.py` dùng mean MSE và Adam cho mạng 32 chiều. Khi đưa code lên slide, giữ rõ nhãn của hai phần này.

### Code và lời giải thích để đưa lên từng slide

Chỉ cần hai tệp hiện có: [training.py](src/training.py) và [toy_rnn.py](src/toy_rnn.py). Các đoạn dưới đây là **trích đoạn cho slide**, không phải chương trình chạy độc lập. Phần ghi log, lưu trace và các bước không liên quan đã được lược bỏ để dễ đọc.

#### Slide 20 — Loss functions

Nguồn: [training.py](src/training.py) → `fit_model()`, tìm `nn.MSELoss()` và `loss_fn(model(x), y)`.

```python
loss_fn = nn.MSELoss()
loss = loss_fn(model(x), y)
```

**Nói khi chỉ vào code:** “Mô hình dự đoán từ đầu vào `x`. MSE so dự đoán đó với đáp án đúng `y`, rồi tính trung bình bình phương sai số.”

**Ghi chú trên slide:** Một dự đoán cho mỗi cửa sổ → một sai số cho mỗi cửa sổ → lấy trung bình trong batch. Đầu ra và nhãn đều ở thang đã biến đổi, chuẩn hóa. Không mô tả code này là tính một loss đầu ra riêng tại mọi timestep. Cross-entropy có thể giữ ở phần lý thuyết về phân loại; hai bài toán hồi quy A6 không dùng hàm đó.

#### Slide 21 — Training loop

Nguồn: [training.py](src/training.py) → `fit_model()`, vòng `for epoch` và `for x, y in loader`.

```python
for epoch in range(1, config["max_epochs"] + 1):
    model.train()
    for x, y in loader:
        optimizer.zero_grad(set_to_none=True)
        loss = loss_fn(model(x), y)
        loss.backward()
        nn.utils.clip_grad_norm_(
            model.parameters(), config["gradient_clip_norm"]
        )
        optimizer.step()
```

**Đặt cạnh code:** Xóa gradient → Dự đoán → Tính loss → BPTT → Clip gradient → Cập nhật trọng số.

**Nói khi chỉ vào code:** “Quy trình lặp qua các batch và epoch. `backward()` tính gradient; `optimizer.step()` dùng Adam để cập nhật trọng số.”

`model.train()` chỉ chuyển chế độ của mô hình; nó không tự học hoặc cập nhật trọng số. `zero_grad()` xóa gradient batch trước vì PyTorch mặc định cộng dồn gradient. Mỗi cửa sổ có `h0 = 0`; trọng số được cập nhật sau mỗi batch. Adam dùng learning rate `0.001` trong cấu hình hiện tại. Phần validation và chọn checkpoint vẫn có trong hàm đầy đủ, nhưng không cần đưa hết lên slide này.

#### Slide 22 — Backpropagation Through Time

Nguồn: [toy_rnn.py](src/toy_rnn.py) → `manual_bptt()`. Đây là đoạn sau khi đã chạy forward, tính `error` và khởi tạo `grad`; phần lưu trace được lược bỏ.

```python
dh = error * params["wy"]

for row in reversed(steps):
    da = dh * (1 - row["h"] ** 2)
    gx, gh, gb = da * row["x"], da * row["h_previous"], da

    grad["wx"] += gx
    grad["wh"] += gh
    grad["b"] += gb

    dh = da * params["wh"]
```

**Nhãn trên slide:** Ví dụ scalar nhỏ để giải thích BPTT.

**Nói khi chỉ vào code:** “Ta đi ngược qua các trạng thái đã lưu. Vì cùng bộ trọng số được dùng ở mọi bước, ta cộng các đóng góp gradient từ từng bước vào cùng tham số.”

`reversed(steps)` đi từ bước cuối về bước đầu. `1 - h²` là đạo hàm của tanh. `wx` là trọng số đầu vào, `wh` là trọng số truy hồi, `b` là bias trạng thái và `wy` nối trạng thái cuối với đầu ra. Dòng cuối truyền gradient về trạng thái trước để tiếp tục vòng lặp.

Ví dụ này dùng loss `½(ŷ−y)²`; huấn luyện thật dùng mean MSE. Trong vòng học thật, `loss.backward()` tự tính BPTT bằng autograd. Hàm `run()` trong cùng tệp kiểm tra gradient thủ công với autograd và sai phân hữu hạn.

#### Slide 23 — Vanishing và exploding gradients

Dùng sơ đồ để giải thích gradient nhỏ dần hoặc lớn dần qua chuỗi, rồi chỉ cách code A6 hạn chế gradient lớn. Nguồn: [training.py](src/training.py) → `fit_model()`.

```python
loss.backward()

nn.utils.clip_grad_norm_(
    model.parameters(), config["gradient_clip_norm"]
)

optimizer.step()
```

**Nói khi chỉ vào code:** “Trước khi cập nhật trọng số, ta giới hạn norm của gradient tham số. Giới hạn trong cấu hình hiện tại là 1.0.”

**Ghi chú trên slide:** Clipping kiểm soát gradient lớn; không khôi phục gradient đã biến mất. Đoạn code này là biện pháp kiểm soát, không phải bằng chứng các checkpoint A6 đã gặp vanishing hoặc exploding gradients.

#### Slide 24 — Vì sao gradient có thể biến mất?

Nguồn: [toy_rnn.py](src/toy_rnn.py) → `manual_bptt()`. Chỉ giữ phần truyền gradient qua trạng thái; hàm đầy đủ còn cộng gradient của các tham số.

```python
for row in reversed(steps):
    da = dh * (1 - row["h"] ** 2)
    dh = da * params["wh"]
```

**Đặt cạnh code:** Thừa số scalar ở mỗi bước là `(1 - h_t²) × w_h`.

**Nói khi chỉ vào code:** “Ở mỗi bước lan truyền ngược, gradient được nhân với đạo hàm tanh và trọng số truy hồi. Nhân liên tiếp qua nhiều bước có thể làm độ lớn gradient nhỏ dần hoặc lớn dần.”

Đây là công thức cho một trạng thái scalar. Với trạng thái vector, cần xét tích các Jacobian `diag(1 - h_t²) W_h`; không kết luận chỉ bằng việc từng phần tử trọng số nhỏ hay lớn hơn 1.

#### Slide 25 — Tổng kết

**Không cần code.** Đưa ba ý lên slide:

- RNN học bằng BPTT.
- Chuỗi dài có thể gây khó khăn cho việc truyền gradient.
- GRU và LSTM dùng các cổng để cải thiện việc truyền thông tin và gradient; không bảo đảm loại bỏ mọi vấn đề gradient.

LSTM là chủ đề tiếp theo trong kịch bản. Các thí nghiệm hiện tại của A6 gồm RNN và GRU.

## Phân biệt bốn phần trước khi mở code

| Phần | Thực sự làm gì? | Không nên nói thành |
| --- | --- | --- |
| Thực nghiệm PyTorch | Chuẩn bị dữ liệu, huấn luyện RNN/GRU, chọn checkpoint bằng validation, dự báo và tính sai số trên test. | “Website đang huấn luyện mô hình.” |
| Bộ xuất demo | Nạp checkpoint; chạy lại đầu vào test; lấy đủ 32 giá trị trạng thái ở từng bước; kiểm tra với công thức và file kết quả đã lưu. | “Các ô màu được tạo ngẫu nhiên để minh họa.” |
| Website | Đọc JSON đã kiểm chứng rồi lần lượt hiện dữ liệu, trạng thái, dự đoán, thực tế và sai số. | “Bấm phát là thực hiện một epoch hoặc cập nhật trọng số.” |
| Ví dụ vô hướng | Dùng 3 số và 1 trạng thái để nhìn rõ lan truyền thuận, gradient và một lần SGD. | “Đây là mô hình đã dự báo dữ liệu cổ phiếu / khách hàng.” |

Phép tính ô 1 mở bằng nút **Xem phép tính**, được trình bày bởi [RNNCalculation.tsx](../website/src/components/demo/RNNCalculation.tsx); ba bước đổi dự báo về đơn vị gốc nằm trong [PredictionReadout.tsx](../website/src/components/demo/PredictionReadout.tsx).

## Các kích thước phải giải thích được

`B` là số cửa sổ trong một batch, `L` là độ dài lịch sử, `F` là số đặc trưng tại mỗi mốc. Batch cuối có thể nhỏ hơn 64.

| Tập dữ liệu | Đầu vào một batch `x` | Mỗi mốc chứa gì? | Mục tiêu mô hình học |
| --- | --- | --- | --- |
| Shopee Thailand (mô phỏng) | `(B, 30, 5)` | `log_sessions`, `log_product_visits`, `log_cart_visits`, `log_checkout_visits`, `log_orders`, đã chuẩn hóa. | `log1p(số đơn ngày sau)`, đã chuẩn hóa. |
| FPT | `(B, 30, 1)` | Log return của từng phiên, đã chuẩn hóa. | Log return phiên tới, đã chuẩn hóa. |

Với `hidden_size=32`, chuỗi đầu ra của RNN có dạng `(B, L, 32)`. Lấy `sequence[:, -1, :]` được `(B, 32)`; `Linear(32, 1)` cho `(B, 1)`. Trạng thái ban đầu có dạng `(1, B, 32)` vì dùng một lớp, một chiều. **32 là số thành phần của trạng thái tại mỗi bước; không phải 32 ngày hay 32 bước thời gian.**

## Các câu hỏi

### Mô hình và trạng thái

File chính: [models.py](src/models.py) → `RecurrentForecaster`. Cấu hình: [config.py](src/config.py) → `CONFIG`.

| Câu hỏi | Mở | Câu trả lời ngắn |
| --- | --- | --- |
| `h₀` lấy ở đâu? | `RecurrentForecaster.forward`; trong [export_demo.py](../website/scripts/export_demo.py), tìm `previous = torch.zeros`. | Không truyền `h₀` vào `nn.RNN`, PyTorch mặc định dùng số 0. Bộ xuất kiểm tra lại công thức với vector 32 số 0. Mỗi cửa sổ độc lập bắt đầu lại từ 0. |
| Vì sao có 32 “nơ-ron”? | `CONFIG["hidden_size"]`, `RecurrentForecaster.__init__`. | Đây là lựa chọn kiến trúc của thực nghiệm. RNN tính lại 32 thành phần trạng thái từ dữ liệu và các tham số đã học; không khẳng định 32 là tối ưu. Không gán mỗi ô màu cho một khái niệm như “giờ cao điểm” khi chưa phân tích. |
| RNN kết hợp dữ liệu mới với quá khứ thế nào? | `self.recurrent(x)`; [export_demo.py](../website/scripts/export_demo.py), tìm `weight_ih_l0` và `weight_hh_l0`. | `hₜ = tanh(Wₓxₜ + bₓ + Wₕhₜ₋₁ + bₕ)`. PyTorch lưu hai bias; có thể gộp chúng thành một bias khi viết công thức. |
| Trọng số đổi sau mỗi ngày không? | Cùng một `self.recurrent` trong `forward`. | Khi dự báo, trọng số cố định và dùng chung ở mọi bước; chỉ trạng thái thay đổi. Trọng số chỉ được cập nhật trong vòng huấn luyện. |
| Trạng thái cuối thành dự đoán ở đâu? | `self.output(sequence[:, -1, :])`. | Lấy 32 thành phần ở bước cuối, đưa qua một lớp tuyến tính để tạo một đầu ra. Đầu ra này còn ở thang chuẩn hóa; phải đổi về đơn vị gốc. |
| `Wₓ` và `Wₕ` lớn bao nhiêu? | `nn.RNN(input_size, hidden_size, batch_first=True)`. | `Wₓ` là `(32, F)`, `Wₕ` là `(32, 32)`, mỗi bias là `(32,)`; lớp cuối có ma trận `(1, 32)` và bias `(1,)`. |
| Trạng thái có được truyền giữa các batch không? | `forward` không nhận/trả trạng thái để dùng cho batch sau. | Không. Đây là mô hình nhiều đầu vào → một đầu ra trên cửa sổ độc lập, không phải huấn luyện stateful xuyên suốt toàn bộ chuỗi. |

### Học, loss và cập nhật

File chính: [training.py](src/training.py) → `fit_model`. Giá trị cấu hình ở [config.py](src/config.py).

| Câu hỏi | Mở | Câu trả lời ngắn |
| --- | --- | --- |
| Loss là gì? | `fit_model`, `loss_fn = nn.MSELoss()`. | Trung bình bình phương chênh lệch giữa đầu ra và nhãn **đã biến đổi, chuẩn hóa**. Đây không phải MAE bằng VND hoặc số đơn hàng. |
| `loss.backward()` làm gì? | `fit_model`, `loss.backward()`. | Autograd tính gradient của loss theo các tham số, qua toàn bộ các bước thời gian. Lệnh này chưa đổi trọng số. |
| Chỗ nào thật sự cập nhật trọng số? | `optimizer.step()`, ngay sau `clip_grad_norm_`. | Adam dùng gradient để cập nhật tham số. `optimizer.zero_grad()` xóa gradient cũ trước batch kế tiếp; clipping giới hạn chuẩn gradient ở 1,0. |
| Adam khác ví dụ SGD thế nào? | `torch.optim.Adam`, rồi `scalarUpdate` của minh họa. | Thực nghiệm dùng Adam với thống kê gradient bậc một/bậc hai. Ví dụ nhỏ dùng SGD để nhìn rõ `tham số mới = tham số cũ − η × gradient`; hai cách cập nhật không đồng nhất. |
| Learning rate bao nhiêu? | `CONFIG`, `learning_rate=0.001`. | Thực nghiệm dùng 0,001. Ví dụ vô hướng dùng 0,1 để quan sát một lần cập nhật; không lấy con số này làm cấu hình của mô hình thật. |
| Batch và epoch khác nhau thế nào? | `DataLoader`, `batch_size=64`, vòng `for epoch`. | Một batch chứa tối đa 64 cửa sổ; Adam cập nhật một lần sau mỗi batch. Một epoch đi qua toàn bộ tập train. Một ngày trong hoạt ảnh không phải một batch hay một epoch. |
| Có phải luôn học đủ 40 epoch không? | `max_epochs`, `patience`, `stale`, `best_epoch`. | 40 là giới hạn. Dừng sớm nếu validation không cải thiện đủ lâu: patience 8 ở cả Shopee Thailand và FPT. Chọn checkpoint có validation MSE thấp nhất, có thể sớm hơn epoch cuối. |
| Vì sao train `shuffle=True` mà vẫn gọi là chuỗi thời gian? | `DataLoader(... shuffle=True)` và phép tạo `x[t-L:t]`. | Chỉ xáo thứ tự các cửa sổ **thuộc train**. Thứ tự mốc bên trong mỗi cửa sổ vẫn giữ nguyên; không trộn train, validation và test. |
| Test có tham gia chọn mô hình không? | `x_validation`, `best_state`, `evaluate`. | Vòng học và chọn checkpoint chỉ đọc train/validation. Chốt checkpoint rồi mới đánh giá test. |

### Dữ liệu, kiểm tra và đơn vị

Shopee Thailand/FPT: [preprocessing.py](src/preprocessing.py) → `prepare_shopee`, `prepare_fpt`, `prepare_data`; [evaluation.py](src/evaluation.py) → `original_units`, `metrics`, `evaluate`.

| Câu hỏi | Mở  | Câu trả lời ngắn |
| --- | --- | --- |
| Tại sao chia theo thời gian? | `prepare_data`, `targets`, `indices`. | Mô phỏng học từ quá khứ rồi dự báo giai đoạn sau. Chia ngẫu nhiên các cửa sổ chồng lấn có thể đưa giai đoạn tương lai vào train. |
| Có lấy tương lai khi chuẩn hóa không? | `train_end`, `x_mean`, `x_scale`, `y_mean`, `y_scale`. | Thống kê đầu vào chỉ fit trên các timestamp thuộc giai đoạn train, gồm phần lịch sử có sẵn. Thống kê nhãn chỉ fit từ nhãn train. Validation/test dùng lại các thống kê đó. |
| Đầu vào có chứa chính nhãn cần đoán không? | `scaled_x[t - lookback:t]`. | Không. Slice dừng trước `t`; nhãn là giá trị tại `t`. Bộ xuất còn kiểm tra mọi timestamp đầu vào nhỏ hơn timestamp mục tiêu. |
| Tại sao test có thể dùng quan sát test trước đó? | `evaluation_policy` trong manifest; `x_test`. | Đây là dự báo **một bước cuốn chiếu**: đến mỗi thời điểm mới, các quan sát trước nó đã có. Không đưa nhãn hiện tại hay tương lai vào đầu vào. |
| Có dự báo nhiều bước bằng cách lấy dự đoán cho vào lại không? | Cách tạo cửa sổ; `original_units`; `evaluation_policy`. | Không. Mỗi dự báo dùng lịch sử quan sát thật. Không nối các dự đoán thành chuỗi tự hồi tiếp nhiều bước. |
| FPT nhận giá VND trực tiếp không? | `prepare_fpt`, `log_return`; `original_units`. | Không. Nhận 30 log return đã chuẩn hóa. Đổi đầu ra về `r̂`, rồi `P̂ₜ = Pₜ₋₁ × exp(r̂)`. `Pₜ₋₁` là giá quan sát đã biết. |
| Shopee Thailand dự báo đơn hàng hay khách hàng? | `prepare_shopee`, `daily_count`, `orders`, `original_units`. | Tổng số **đơn hàng mỗi ngày** trong mô phỏng. `order_id` phải duy nhất. Không dự báo một khách cụ thể. Bỏ chuẩn hóa rồi `max(0, expm1(log_count))`; dự đoán có thể là số thập phân. |
| Baseline “giữ nguyên” ở đâu? | `evaluate`, nhánh `persistence`. | Dự đoán tại `t` bằng giá trị ở `t−1`. So với RNN trên đúng các nhãn test đó. |
| MAE tính thế nào? | `metrics`, `np.abs(errors).mean()`. | `mean(abs(dự đoán − thực tế))`, sau khi đã đổi về đơn vị gốc. Bộ xuất demo tính lại MAE từ toàn bộ CSV test; không lấy sai số của một hình minh họa làm MAE. |

### Website và minh họa

| Giảng viên hỏi | File → hàm / từ khóa | Câu trả lời ngắn |
| --- | --- | --- |
| Website lấy kết quả ở đâu? | [useDemoData.ts](../website/src/hooks/useDemoData.ts) → `useDemoData`, `/data/demo.json`; [demoTypes.ts](../website/src/demoTypes.ts) → `DemoDataset`, `DemoContext`. | JSON lưu cửa sổ đầu vào, trạng thái 32 chiều, dự đoán, nhãn và các chỉ số đã kiểm chứng. Kiểu TypeScript mô tả cấu trúc, không tự chứng minh mô hình đúng. |
| Bảng “Đầu vào” lấy số liệu ở đâu? | [CurrentInputs.tsx](../website/src/components/demo/CurrentInputs.tsx) → `CurrentInputs`; [inputReadout.ts](../website/src/domain/demo/inputReadout.ts) → `getInputReadout`. | Chỉ lấy quan sát tại `context[read−1]` trong cửa sổ đã đọc. Trước bước 1, hiện dấu “—”, chưa lấy số liệu hay timestamp của quan sát đầu. Không đọc nhãn tương lai; thời gian giữ nguyên đồng hồ nguồn. |
| Vì sao Shopee có 5 giá trị, FPT chỉ có 1? | `getInputReadout`, `featureNames`, `normalizedInput`. | Shopee: 5 số đếm qua log1p, gồm session, lượt thăm sản phẩm, giỏ, thanh toán và đơn. FPT: 1 log return. Bảng hiện số đếm gốc hoặc lợi suất dưới dạng %. Mạng dùng vector đã chuẩn hóa theo train. |
| Khi bấm phát, có chạy PyTorch hoặc học lại không? | [useDemoPlayback.ts](../website/src/hooks/useDemoPlayback.ts) → `useDemoPlayback`; [replayTimeline.ts](../website/src/domain/demo/replayTimeline.ts) → `advanceReplay`, `getFrameDuration`. | Không. Đồng hồ điều khiển mốc và phần chuyển động đang hiển thị. Đổi tốc độ giữ phần đã phát, thay nhịp phần còn lại. Không tính gradient, không cập nhật trọng số. |
| Vì sao trạng thái mới được đưa về bên trạng thái trước? | [stateHandover.ts](../website/src/domain/demo/stateHandover.ts) → `getHandoverPhase`; [RecurrentMechanism.tsx](../website/src/components/demo/RecurrentMechanism.tsx) → `RecurrentMechanism`. | Hai bước đầu có hoạt ảnh nhận đầu vào, cập nhật, hiện trạng thái mới và truyền tiếp; từ bước 3 chỉ cập nhật giá trị, không lặp chuyển động. `hₜ` trở thành trạng thái trước cho bước `t+1`; đây vẫn là một RNN dùng chung trọng số. Bước cuối không truyền sang một quan sát lịch sử không tồn tại. |
| Tạm dừng hoặc đổi tốc độ có tính lại bước không? | [useReplayClock.ts](../website/src/hooks/useReplayClock.ts) → `useReplayClock`; [stateHandover.ts](../website/src/domain/demo/stateHandover.ts) → `advanceClock`. | Không. Giữ thời gian đã tích lũy trong bước; tiếp tục cộng từ đó. Riêng khi tua, giao diện hiện trạng thái hoàn tất ở bước được chọn; bấm phát tiếp tục từ bước đó; chỉ bước 1 và 2 có chuyển động truyền trạng thái. Đây là quy tắc trình chiếu, không phải phép tính RNN. |
| Các ô màu trạng thái có thật không? | [RecurrentMechanism.tsx](../website/src/components/demo/RecurrentMechanism.tsx) → `RecurrentMechanism`, `hiddenState`; [demoCopy.ts](../website/src/domain/demo/demoCopy.ts) → `stateColor`. | Mỗi ô biểu diễn một thành phần trạng thái từ checkpoint. Dữ liệu tại `read−1` là trạng thái sau bước đang đọc, tại `read−2` là trạng thái trước. Chú giải “Âm · 0 · Dương” cho biết dấu; độ đậm biểu diễn độ lớn. Không gán màu thành tăng/giảm giá hay mức tốt/xấu của mô hình. |
| Linear có xuất trực tiếp VND hoặc số đơn hàng không? | [PredictionReadout.tsx](../website/src/components/demo/PredictionReadout.tsx) → `PredictionReadout`, `predictedStandardized`; [demoCopy.ts](../website/src/domain/demo/demoCopy.ts) → `OUTPUT_COPY`. | Linear biến 32 thành phần trạng thái cuối thành 1 số **đã chuẩn hóa**. Bỏ chuẩn hóa rồi hoàn nguyên: Shopee Thailand dùng expm1 và chặn âm ở 0; FPT lấy giá cuối × exp(lợi suất log). Đây là kết quả checkpoint đã tính trước. |
| Công thức từng bước có khớp PyTorch không? | [export_demo.py](../website/scripts/export_demo.py) → `replay_recurrence`, `export_dataset`, `np.testing.assert_allclose`. | Bộ xuất tự tính lại `tanh(Wₓxₜ+bₓ+Wₕhₜ₋₁+bₕ)` từ `h₀=0`, rồi so với toàn bộ chuỗi trạng thái PyTorch trong sai số số thực cho phép. |
| Nguồn các phép nhân của ô 1 ở đâu? | [export_demo.py](../website/scripts/export_demo.py) → `trace_first_component`; [demoTypes.ts](../website/src/demoTypes.ts) → `calculation`, `recurrentUnit`. | Lấy hàng 0 của `weight_ih_l0` và `weight_hh_l0` từ checkpoint, nhân với đầu vào chuẩn hóa và trạng thái trước của PyTorch, xuất từng tích, hai bias, tổng và tanh. Ô 1 là `h[0]`; mô hình vẫn tính đủ 32 ô. `replay_recurrence` kiểm tra toàn vector, còn hàm này tách một ô để người xem đọc phép tính. |
| Phép tính trong hộp thoại có dùng một mô hình khác không? | [RNNCalculation.tsx](../website/src/components/demo/RNNCalculation.tsx) → `RNNCalculation`; [PredictionReadout.tsx](../website/src/components/demo/PredictionReadout.tsx) → `PredictionReadout`; [export_demo.py](../website/scripts/export_demo.py) → `output_weights`, `normalization`. | Không. Hộp thoại hiện tổng các tích từ dữ liệu mới, trạng thái trước và hai bias để tính ô 1. Phần đổi đơn vị hiện đầu ra Linear, bỏ chuẩn hóa và đổi đơn vị bằng dữ liệu checkpoint đã xuất; không cập nhật tham số. |
| Phép tính bằng số có lộ dự đoán sớm không? | [PhasePanel.tsx](../website/src/components/demo/PhasePanel.tsx) → `PhasePanel`; [DemoDialog.tsx](../website/src/components/demo/DemoDialog.tsx) → `predicted`; [PredictionReadout.tsx](../website/src/components/demo/PredictionReadout.tsx) → `PredictionReadout`. | Chưa đọc đầu vào thì chưa có ví dụ tính trạng thái. Các số của dự báo cuối chỉ xuất hiện ở pha Dự đoán, sau khi đọc đủ chuỗi. Tua lùi ẩn lại đầu ra. Nút Xem phép tính tạm dừng demo và mở chi tiết tại đúng bước; DemoDialog chỉ hiện phần đổi đơn vị khi predicted là true. |
| Làm sao biết đã dùng đúng checkpoint và đầu vào? | [export_demo.py](../website/scripts/export_demo.py) → `checkpoint_hash`, `normalized`, `arrays["x_test"][0]`, `replayed`. | Kiểm tra SHA checkpoint; tái chuẩn hóa và so với cửa sổ lưu; so dự đoán chạy lại với CSV test. Không chỉ kiểm tra hình vẽ. |
| Vì sao ví dụ này được chọn? | [export_demo.py](../website/scripts/export_demo.py) → `target_index = int(ids[0])`. | Chọn mục tiêu test đầu tiên theo thời gian, không tìm mẫu đẹp nhất. Shopee: 30/05/2025, RNN khoảng 289,60 đơn, thực tế 301, hôm trước 300. Một ví dụ không đại diện toàn test. |
| Vì sao tách “Dự đoán”, “Thực tế”, “Toàn tập”? | [replayTimeline.ts](../website/src/domain/demo/replayTimeline.ts) → `getReplayPhase`; [PhasePanel.tsx](../website/src/components/demo/PhasePanel.tsx) → `PhasePanel`. | Đọc hết lịch sử mới hiện dự đoán, rồi hiện nhãn để so một trường hợp. Giai đoạn cuối mới dùng MAE toàn tập. Việc ẩn nhãn trên UI chỉ phục vụ trình bày; tính nhân quả được kiểm tra ở dữ liệu/exporter. |
| Các câu kết luận nằm ở đâu? | [demoCopy.ts](../website/src/domain/demo/demoCopy.ts) → `DATASET_COPY`, `compareText`, `getCaption`; [DemoSummary.tsx](../website/src/components/demo/DemoSummary.tsx) → `DemoSummary`. | Nội dung nằm riêng khỏi thuật toán phát; kết luận dựa trên MAE thật và ghi rõ giới hạn một lần thực nghiệm. |
| Ví dụ một trạng thái tính ở đâu? | [scalarRnn.ts](../website/src/domain/learning/scalarRnn.ts) → `scalarForward`, `scalarGradient`, `scalarUpdate`. | Ba số đầu vào minh họa → ba trạng thái → dự đoán → loss `½(ŷ−y)²` → BPTT → một lần SGD. Dùng chung trọng số qua ba bước và cộng đóng góp gradient từ mọi bước. |
| Tại sao ví dụ nhỏ có `½` nhưng thực nghiệm không có? | `scalarGradient`; [training.py](src/training.py) → `nn.MSELoss`. | Hệ số `½` làm đạo hàm ví dụ dễ đọc. Thực nghiệm dùng MSE của PyTorch. Không so trực tiếp trị loss hoặc độ lớn gradient của hai phần. |
| Biểu đồ loss ở phần tham khảo thuộc mô hình nào? | [TrainingHistory.tsx](../website/src/components/TrainingHistory.tsx) → `data.history.rnn`, `data.models.rnn.bestEpoch`; [Presentation.tsx](../website/src/components/Presentation.tsx) → `/data/shopee.json`. | Lịch sử RNN Shopee: 19 epoch đã chạy, checkpoint epoch 11 được chọn bằng validation MSE. Thanh epoch chỉ xem lịch sử; không học lại. Loss đo log1p số đơn đã chuẩn hóa, không đo MAE bằng số đơn. |
| Nút minh họa học lại có sửa checkpoint không? | [useTrainingReplay.ts](../website/src/components/explanations/useTrainingReplay.ts) → `useTrainingReplay`; [TrainingAnswer.tsx](../website/src/components/explanations/TrainingAnswer.tsx) → `TrainingAnswer`. | Chỉ đổi trạng thái phát của ví dụ vô hướng; tham số cập nhật minh họa thuộc ví dụ riêng. Không sửa file `.pt`, dữ liệu test hoặc dự đoán của demo chính. |
| Có kiểm chứng gradient thủ công không? | [toy_rnn.py](src/toy_rnn.py) → `manual_bptt`, `run`, `torch_loss.backward`. | So gradient BPTT thủ công với sai phân hữu hạn và autograd. Đây là kiểm chứng toán của ví dụ vô hướng, không thay thế kiểm tra mô hình 32 chiều. |


## Số liệu để đối chiếu nhanh

Đây là **RNN** trong demo chính.

| Tập | Epoch đã chạy | Epoch của checkpoint chọn | MAE RNN trên test | MAE giữ nguyên giá trị trước |
| --- | ---: | ---: | ---: | ---: |
| Shopee Thailand (mô phỏng) | 19 | 11 | 309,7479 đơn/ngày | 141,5556 đơn/ngày |
| FPT | 9 | 1 | 1.059,9227 VND | 1.053,7275 VND |

Nguồn đối chiếu: [Shopee Thailand manifest](results/shopee/manifest.json), [FPT manifest](results/fpt/manifest.json). Tìm `best_epoch`, `epochs_run`, `metrics`, `test`, `MAE`.

**Cách kết luận:** “Trên lần chia này, RNN và GRU chưa tốt hơn cách giữ số đơn hôm trước về MAE trên Shopee mô phỏng. Trên FPT cũng chưa có lợi thế về MAE/RMSE. Một ví dụ chưa đủ kết luận; dùng toàn test và không so trực tiếp các tập khác đơn vị.”


## Đổi dữ liệu cổ phiếu sang FPT, 02/10/2026

FPT dùng `FPT.csv` từ [Stock Prices & Volume VN30 Index Vietnam](https://www.kaggle.com/datasets/thangtranquang/stock-vn30-vietnam), Thang Tran, CC0. `prepare_fpt` đọc `TradingDate` bằng `%d/%m/%Y`, loại 87 dòng trùng hoàn toàn và 1 dòng trùng ngày/OHLCV chỉ khác cột Value không dùng. Có 2.618 phiên; bỏ phiên đầu để tính 2.617 lợi suất log. Các trường OHLC phụ có 6 dòng không nhất quán, được ghi trong audit; mô hình chỉ dùng Close dương, không tự sửa giá.

Chỉ có **Close**, không có **Adj Close** hay mô tả điều chỉnh. Không được gọi giá FPT là giá điều chỉnh. Mô hình vẫn dùng 30 × 1, hidden_size 32, chia theo thời gian: 1.810 train, 388 validation, 389 test. Hai mạng FPT đều chạy 9 epoch, chọn epoch 1. Tối đa 40 không có nghĩa luôn chạy 40; sau epoch 1 có 8 epoch không cải thiện nên dừng.

Phần **Toàn tập**: `evaluate` gọi `metrics` trong [evaluation.py](src/evaluation.py). MAE là `np.abs(predicted - actual).mean()` sau khi đổi về VND; baseline là `previous.copy()`. Website chỉ hiển thị kết quả xuất sẵn, không tính sai số từ riêng mẫu đang xem.

## Shopee Thailand: từ CSV đến ngày dự báo

Nguồn là **100% mô phỏng Shopee Thailand**, do Hnin Shwe Zin Hlaing đăng trên Kaggle, phiên bản 1, CC BY-SA 4.0. Không phải dữ liệu chính thức từ Shopee hoặc thị trường Việt Nam.

| Bước cần chỉ | File / hàm | Cách giải thích |
| --- | --- | --- |
| Đọc dữ liệu | `prepare_shopee` trong [preprocessing.py](src/preprocessing.py) | Ba CSV: 500.000 session, 2.696.481 lượt thăm trang, 300.000 đơn. |
| Kiểm tra liên kết | `linked`, `bounds`, kiểm tra ID | Session, activity và order có ID duy nhất. Activity phải thuộc session hợp lệ; đơn liên kết phải cùng ngày session. |
| Tổng hợp theo ngày | `daily_count` | Đếm session bắt đầu, lượt thăm `/products`, `/cart`, `/checkout`, và đơn theo `order_date`. Lượt thăm giỏ không phải thao tác thêm giỏ. |
| Giữ đúng lịch nguồn | `start`, `stop`, `days` | 1.461 ngày trong 2022–2025. Bỏ lượt thăm bắt đầu sang 01/01/2026; UTC chỉ lưu nhãn ngày vì nguồn không ghi múi giờ. |
| Tạo mẫu | `prepare_data`, `scaled_x[t-lookback:t]` | 30 ngày × 5 số, nhãn là số đơn ngày kế tiếp. Không đưa lượt thăm, order link hay đơn của ngày đích vào X. |
| Đối chứng | `evaluate`, `persistence`, `seasonal` | Đoán như hôm trước; hoặc như cùng thứ 7 ngày trước. Cùng các ngày test với RNN/GRU. |

Train / validation / test có **1.001 / 214 / 216** cửa sổ, chia theo ngày đích. RNN chạy 19 epoch, chọn epoch 11; GRU chạy 10 epoch, chọn epoch 2. Giới hạn cấu hình vẫn là 40 epoch, patience 8. Đây không phải kết quả tìm kiếm hidden size tối ưu.

| Mô hình Shopee | MAE (đơn/ngày) | RMSE (đơn/ngày) |
| --- | ---: | ---: |
| RNN | 309,7479 | 589,7574 |
| GRU | 299,7403 | 578,1637 |
| Đoán như hôm trước | 141,5556 | 599,1383 |
| Cùng thứ tuần trước | 160,5972 | 600,3748 |

MAE và RMSE có thể xếp hạng khác nhau vì RMSE phạt sai số lớn mạnh hơn. Không nói “RNN tốt hơn” chỉ vì RMSE thấp hơn khi MAE cao hơn. Chưa có kiểm chứng về hiệu quả trên khách hàng Shopee thực tế.

## FPT dùng dữ liệu cập nhật từ KBS/Vnstock

Đây là luồng bổ sung, tách khỏi replay Kaggle. Xem `models/daily/README.md` cho lệnh chạy.

| Bước demo | File và hàm |
| --- | --- |
| Lấy giá sau khi phiên hoàn thành | `daily/provider.py`: `fetch`; `daily/core.py`: `clean_closes` |
| 31 giá → 30 log return, chia theo thời gian | `daily/core.py`: `prepare_windows` |
| Huấn luyện RNN, chọn checkpoint bằng validation | `daily/pipeline.py`: `train` → `src/training.py`: `fit_model` |
| Dự báo với scaler và trọng số đã lưu | `daily/core.py`: `forecast_input`; `daily/pipeline.py`: `make_forecast` |
| Cập nhật từ website | `daily/api.py`: POST `/api/fpt/daily/refresh` |
| Kiểm tra RNN bằng NumPy độc lập | `daily/audit.py`: `audit` |

Câu trình bày: “Sau khi có giá đóng cửa, hệ thống lấy 30 mức thay đổi gần nhất để dự báo phiên kế tiếp. Khi bấm cập nhật, trọng số giữ nguyên. Kết quả test vẫn được hiển thị để người xem biết giới hạn của mô hình.”
# Chat đầu tư FPT: chỉ code nào khi được hỏi?

| Câu hỏi | Đọc code |
| --- | --- |
| “Tôi có 200 triệu…” đi vào đâu? | `chat/api.py`: endpoint POST `/api/chat`; `chat/service.py`: `answer()` |
| Vì sao nhắc vốn không tự mở bảng tính hoặc bài giảng? | `chat/service.py`: `reply_mode(messages)` phân biệt câu hỏi thông thường, kỹ thuật và yêu cầu tính toán; mặc định trả lời tiếng Việt dễ hiểu và hỏi tối đa một thông tin còn thiếu |
| Chat lấy bằng chứng từ đâu? | `chat/evidence.py`: `corpus()` đọc dữ liệu FPT đang hoạt động; mỗi đoạn có mã nguồn và vị trí |
| Neo4j nằm ở bước nào? | `chat/graph.py`: `retrieve()` nhập node/quan hệ, tìm fulltext rồi duyệt Forecast → ModelRun → Evaluation và Forecast → Snapshot → Source |
| RAG là gì trong chương trình này? | `chat/service.py`: truy xuất trước, `prepare_evidence(evidence, data, technical=...)` tóm tắt tài liệu và graph facts cho câu hỏi thông thường, rồi gửi bằng chứng cùng hội thoại vào `generate()` |
| Khi nào giải thích MAE hoặc baseline? | `chat/service.py`: chế độ kỹ thuật giữ chỉ số khi người dùng hỏi rõ; không tự đưa bảng MAE vào câu trả lời đầu tư thông thường |
| Ai tính số cổ phiếu và tiền còn lại? | `chat/calculator.py`: `scenario()` dùng Decimal khi có yêu cầu tính số cổ phiếu rõ ràng; chỉ nhắc 200 triệu không kích hoạt phép tính, không tự tạo kịch bản giảm 10%/20%; tiền đầu tư không đưa vào RNN |
| API key ở đâu? | File cục bộ `models/.env`, đọc qua `chat/config.py`; không đưa lên Git, ZIP hoặc browser |
| Giao diện và nguồn câu trả lời? | `website/src/components/StockChat.tsx`: `submit()` và `Evidence()`; nguồn là phần tham khảo phụ, mặc định thu gọn |
| Lỗi hoặc thiếu key thì sao? | `chat/api.py`: lỗi cụ thể; không sinh câu trả lời giả, không in bí mật |

Đây là RAG theo từ khóa và quan hệ Neo4j, chưa dùng vector embedding. RNN vẫn dự báo **một phiên** từ 30 log return; API ngôn ngữ chỉ giúp trao đổi và giải thích. Đọc hướng dẫn đầy đủ tại `chat/README.md`.


## Dự báo và chat theo thời hạn 1/3/6 tháng

| Câu hỏi | Code |
| --- | --- |
| Sáu tháng được học như thế nào? | `outlook/core.py`: `prepare_windows`, nhãn `log(Close[t+126]/Close[t])`; đầu vào 60 log return |
| Tránh dùng tương lai ở đâu? | `prepare_windows`: nhãn train kết thúc trước origin validation, nhãn validation trước origin test; scaler chỉ fit train |
| Train và lưu ba mô hình? | `outlook/pipeline.py`: `train`, dùng `src/training.py:fit_model`; 21/63/126 phiên có checkpoint riêng |
| Khi cập nhật giá có học lại? | `daily/pipeline.py:refresh` gọi `outlook/pipeline.py:refresh`, chỉ suy luận bằng checkpoint đã lưu |
| Xem đánh giá thật? | `outlook/artifacts/<run-id>/manifest.json` và `<horizon>_test_predictions.csv`; có cột origin, target và nhóm không chồng lấp |
| Chat lấy thông tin doanh nghiệp? | `chat/company_evidence.json`, được lọc ngày/nguồn trong `chat/investment.py` |
| Neo4j liên kết các thời hạn? | `chat/graph.py:retrieve`, HorizonForecast → FOR_STOCK/PRODUCED_BY/USES_INPUT; Publication → ABOUT → FPT |
| Vì sao chat biết đang hỏi sáu tháng? | `chat/service.py:requested_horizon`, lựa chọn H6 từ lịch sử câu người dùng; `prepare_evidence` diễn giải dữ liệu theo đúng thời hạn |
| Website hiển thị ở đâu? | `InvestmentOutlook.tsx` trong trang FPT; `/api/fpt/outlook` đọc dự báo tương thích với bản giá đang hoạt động |

Dự báo tháng vẫn thử nghiệm. Ba mô hình hiện chưa vượt baseline; dữ liệu doanh nghiệp hỗ trợ thảo luận nhưng không biến kết quả này thành chiến lược đầu tư đã được chứng minh.
