# Bản đồ code để trình bày và trả lời câu hỏi A6

Bản đồ này dành cho demo **Retailrocket và Amazon**. Mỗi tập có một RNN và một GRU được huấn luyện riêng: tổng cộng bốn mạng; hoạt ảnh chính phát lại hai RNN.

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

Phép tính ô 1 hiện trực tiếp trong [RNNCalculation.tsx](../website/src/components/demo/RNNCalculation.tsx); ba bước đổi dự báo về đơn vị gốc nằm trong [PredictionReadout.tsx](../website/src/components/demo/PredictionReadout.tsx).

## Các kích thước phải giải thích được

`B` là số cửa sổ trong một batch, `L` là độ dài lịch sử, `F` là số đặc trưng tại mỗi mốc. Batch cuối có thể nhỏ hơn 64.

| Tập dữ liệu | Đầu vào một batch `x` | Mỗi mốc chứa gì? | Mục tiêu mô hình học |
| --- | --- | --- | --- |
| Retailrocket | `(B, 24, 7)` | `log_view`, `log_addtocart`, `log_transaction` và 4 đặc trưng lịch sin/cos. | `log1p(số sự kiện giao dịch giờ tới)`, đã chuẩn hóa. |
| Amazon | `(B, 30, 1)` | Log return của từng phiên, đã chuẩn hóa. | Log return phiên tới, đã chuẩn hóa. |

Với `hidden_size=32`, chuỗi đầu ra của RNN có dạng `(B, L, 32)`. Lấy `sequence[:, -1, :]` được `(B, 32)`; `Linear(32, 1)` cho `(B, 1)`. Trạng thái ban đầu có dạng `(1, B, 32)` vì dùng một lớp, một chiều. **32 là số thành phần của trạng thái tại mỗi bước; không phải 32 giờ hay 32 bước thời gian.**

## Các câu hỏi

### Mô hình và trạng thái

File chính: [models.py](src/models.py) → `RecurrentForecaster`. Cấu hình: [config.py](src/config.py) → `CONFIG`.

| Câu hỏi | Mở | Câu trả lời ngắn |
| --- | --- | --- |
| `h₀` lấy ở đâu? | `RecurrentForecaster.forward`; trong [export_demo.py](../website/scripts/export_demo.py), tìm `previous = torch.zeros`. | Không truyền `h₀` vào `nn.RNN`, PyTorch mặc định dùng số 0. Bộ xuất kiểm tra lại công thức với vector 32 số 0. Mỗi cửa sổ độc lập bắt đầu lại từ 0. |
| Vì sao có 32 “nơ-ron”? | `CONFIG["hidden_size"]`, `RecurrentForecaster.__init__`. | Đây là lựa chọn kiến trúc của thực nghiệm. RNN tính lại 32 thành phần trạng thái từ dữ liệu và các tham số đã học; không khẳng định 32 là tối ưu. Không gán mỗi ô màu cho một khái niệm như “giờ cao điểm” khi chưa phân tích. |
| RNN kết hợp dữ liệu mới với quá khứ thế nào? | `self.recurrent(x)`; [export_demo.py](../website/scripts/export_demo.py), tìm `weight_ih_l0` và `weight_hh_l0`. | `hₜ = tanh(Wₓxₜ + bₓ + Wₕhₜ₋₁ + bₕ)`. PyTorch lưu hai bias; có thể gộp chúng thành một bias khi viết công thức. |
| Trọng số đổi sau mỗi giờ không? | Cùng một `self.recurrent` trong `forward`. | Khi dự báo, trọng số cố định và dùng chung ở mọi bước; chỉ trạng thái thay đổi. Trọng số chỉ được cập nhật trong vòng huấn luyện. |
| Trạng thái cuối thành dự đoán ở đâu? | `self.output(sequence[:, -1, :])`. | Lấy 32 thành phần ở bước cuối, đưa qua một lớp tuyến tính để tạo một đầu ra. Đầu ra này còn ở thang chuẩn hóa; phải đổi về đơn vị gốc. |
| `Wₓ` và `Wₕ` lớn bao nhiêu? | `nn.RNN(input_size, hidden_size, batch_first=True)`. | `Wₓ` là `(32, F)`, `Wₕ` là `(32, 32)`, mỗi bias là `(32,)`; lớp cuối có ma trận `(1, 32)` và bias `(1,)`. |
| Trạng thái có được truyền giữa các batch không? | `forward` không nhận/trả trạng thái để dùng cho batch sau. | Không. Đây là mô hình nhiều đầu vào → một đầu ra trên cửa sổ độc lập, không phải huấn luyện stateful xuyên suốt toàn bộ chuỗi. |

### Học, loss và cập nhật

File chính: [training.py](src/training.py) → `fit_model`. Giá trị cấu hình ở [config.py](src/config.py).

| Câu hỏi | Mở | Câu trả lời ngắn |
| --- | --- | --- |
| Loss là gì? | `fit_model`, `loss_fn = nn.MSELoss()`. | Trung bình bình phương chênh lệch giữa đầu ra và nhãn **đã biến đổi, chuẩn hóa**. Đây không phải MAE bằng USD hoặc số sự kiện. |
| `loss.backward()` làm gì? | `fit_model`, `loss.backward()`. | Autograd tính gradient của loss theo các tham số, qua toàn bộ các bước thời gian. Lệnh này chưa đổi trọng số. |
| Chỗ nào thật sự cập nhật trọng số? | `optimizer.step()`, ngay sau `clip_grad_norm_`. | Adam dùng gradient để cập nhật tham số. `optimizer.zero_grad()` xóa gradient cũ trước batch kế tiếp; clipping giới hạn chuẩn gradient ở 1,0. |
| Adam khác ví dụ SGD thế nào? | `torch.optim.Adam`, rồi `scalarUpdate` của minh họa. | Thực nghiệm dùng Adam với thống kê gradient bậc một/bậc hai. Ví dụ nhỏ dùng SGD để nhìn rõ `tham số mới = tham số cũ − η × gradient`; hai cách cập nhật không đồng nhất. |
| Learning rate bao nhiêu? | `CONFIG`, `learning_rate=0.001`. | Thực nghiệm dùng 0,001. Ví dụ vô hướng dùng 0,1 để quan sát một lần cập nhật; không lấy con số này làm cấu hình của mô hình thật. |
| Batch và epoch khác nhau thế nào? | `DataLoader`, `batch_size=64`, vòng `for epoch`. | Một batch chứa tối đa 64 cửa sổ; Adam cập nhật một lần sau mỗi batch. Một epoch đi qua toàn bộ tập train. Một giờ trong hoạt ảnh không phải một batch hay một epoch. |
| Có phải luôn học đủ 40 epoch không? | `max_epochs`, `patience`, `stale`, `best_epoch`. | 40 là giới hạn. Dừng sớm nếu validation không cải thiện đủ lâu: patience 8 ở cả Retailrocket và Amazon. Chọn checkpoint có validation MSE thấp nhất, có thể sớm hơn epoch cuối. |
| Vì sao train `shuffle=True` mà vẫn gọi là chuỗi thời gian? | `DataLoader(... shuffle=True)` và phép tạo `x[t-L:t]`. | Chỉ xáo thứ tự các cửa sổ **thuộc train**. Thứ tự mốc bên trong mỗi cửa sổ vẫn giữ nguyên; không trộn train, validation và test. |
| Test có tham gia chọn mô hình không? | `x_validation`, `best_state`, `evaluate`. | Vòng học và chọn checkpoint chỉ đọc train/validation. Chốt checkpoint rồi mới đánh giá test. |

### Dữ liệu, kiểm tra và đơn vị

Retailrocket/Amazon: [preprocessing.py](src/preprocessing.py) → `prepare_retailrocket`, `prepare_amazon`, `prepare_data`; [evaluation.py](src/evaluation.py) → `original_units`, `metrics`, `evaluate`.

| Câu hỏi | Mở  | Câu trả lời ngắn |
| --- | --- | --- |
| Tại sao chia theo thời gian? | `prepare_data`, `targets`, `indices`. | Mô phỏng học từ quá khứ rồi dự báo giai đoạn sau. Chia ngẫu nhiên các cửa sổ chồng lấn có thể đưa giai đoạn tương lai vào train. |
| Có lấy tương lai khi chuẩn hóa không? | `train_end`, `x_mean`, `x_scale`, `y_mean`, `y_scale`. | Thống kê đầu vào chỉ fit trên các timestamp thuộc giai đoạn train, gồm phần lịch sử có sẵn. Thống kê nhãn chỉ fit từ nhãn train. Validation/test dùng lại các thống kê đó. |
| Đầu vào có chứa chính nhãn cần đoán không? | `scaled_x[t - lookback:t]`. | Không. Slice dừng trước `t`; nhãn là giá trị tại `t`. Bộ xuất còn kiểm tra mọi timestamp đầu vào nhỏ hơn timestamp mục tiêu. |
| Tại sao test có thể dùng quan sát test trước đó? | `evaluation_policy` trong manifest; `x_test`. | Đây là dự báo **một bước cuốn chiếu**: đến mỗi thời điểm mới, các quan sát trước nó đã có. Không đưa nhãn hiện tại hay tương lai vào đầu vào. |
| Có dự báo nhiều bước bằng cách lấy dự đoán cho vào lại không? | Cách tạo cửa sổ; `original_units`; `evaluation_policy`. | Không. Mỗi dự báo dùng lịch sử quan sát thật. Không nối các dự đoán thành chuỗi tự hồi tiếp nhiều bước. |
| Amazon nhận giá USD trực tiếp không? | `prepare_amazon`, `log_return`; `original_units`. | Không. Nhận 30 log return đã chuẩn hóa. Đổi đầu ra về `r̂`, rồi `P̂ₜ = Pₜ₋₁ × exp(r̂)`. `Pₜ₋₁` là giá quan sát đã biết. |
| Retailrocket dự báo đơn hàng hay khách hàng? | `prepare_retailrocket`, `groupby`, `transaction`, `original_units`. | Tổng số **sự kiện giao dịch mỗi giờ**. Không phải số khách hàng mua, doanh thu hay số đơn duy nhất. Đổi đầu ra bằng `max(0, expm1(z × σ_train + μ_train))`; dự đoán có thể là số thập phân. |
| Baseline “giữ nguyên” ở đâu? | `evaluate`, nhánh `persistence`. | Dự đoán tại `t` bằng giá trị ở `t−1`. So với RNN trên đúng các nhãn test đó. |
| MAE tính thế nào? | `metrics`, `np.abs(errors).mean()`. | `mean(abs(dự đoán − thực tế))`, sau khi đã đổi về đơn vị gốc. Bộ xuất demo tính lại MAE từ toàn bộ CSV test; không lấy sai số của một hình minh họa làm MAE. |

### Website và minh họa

| Giảng viên hỏi | File → hàm / từ khóa | Câu trả lời ngắn |
| --- | --- | --- |
| Website lấy kết quả ở đâu? | [useDemoData.ts](../website/src/hooks/useDemoData.ts) → `useDemoData`, `/data/demo.json`; [demoTypes.ts](../website/src/demoTypes.ts) → `DemoDataset`, `DemoContext`. | JSON lưu cửa sổ đầu vào, trạng thái 32 chiều, dự đoán, nhãn và các chỉ số đã kiểm chứng. Kiểu TypeScript mô tả cấu trúc, không tự chứng minh mô hình đúng. |
| Bảng “Đầu vào” lấy số liệu ở đâu? | [CurrentInputs.tsx](../website/src/components/demo/CurrentInputs.tsx) → `CurrentInputs`; [inputReadout.ts](../website/src/domain/demo/inputReadout.ts) → `getInputReadout`. | Chỉ lấy quan sát tại `context[read−1]` trong cửa sổ đã đọc. Trước bước 1, hiện dấu “—”, chưa lấy số liệu hay timestamp của quan sát đầu. Không đọc nhãn tương lai; thời gian giữ nguyên đồng hồ nguồn. |
| Vì sao Retailrocket có 7 giá trị, Amazon chỉ có 1? | `getInputReadout`, `featureNames`, `normalizedInput`. | Retailrocket: 3 số đếm qua log1p + 4 giá trị sin/cos giờ và thứ; Amazon: 1 log return. Bảng hiện số đếm gốc hoặc lợi suất log dưới dạng % để dễ đọc. Vector thật vào RNN đã chuẩn hóa theo tập học và không bị thay đổi bởi cách hiển thị. |
| Khi bấm phát, có chạy PyTorch hoặc học lại không? | [useDemoPlayback.ts](../website/src/hooks/useDemoPlayback.ts) → `useDemoPlayback`; [replayTimeline.ts](../website/src/domain/demo/replayTimeline.ts) → `advanceReplay`, `getFrameDuration`. | Không. Đồng hồ điều khiển mốc và phần chuyển động đang hiển thị. Đổi tốc độ giữ phần đã phát, thay nhịp phần còn lại. Không tính gradient, không cập nhật trọng số. |
| Vì sao trạng thái mới được đưa về bên trạng thái trước? | [stateHandover.ts](../website/src/domain/demo/stateHandover.ts) → `getHandoverPhase`; [RecurrentMechanism.tsx](../website/src/components/demo/RecurrentMechanism.tsx) → `RecurrentMechanism`. | Hai bước đầu có hoạt ảnh nhận đầu vào, cập nhật, hiện trạng thái mới và truyền tiếp; từ bước 3 chỉ cập nhật giá trị, không lặp chuyển động. `hₜ` trở thành trạng thái trước cho bước `t+1`; đây vẫn là một RNN dùng chung trọng số. Bước cuối không truyền sang một quan sát lịch sử không tồn tại. |
| Tạm dừng hoặc đổi tốc độ có tính lại bước không? | [useReplayClock.ts](../website/src/hooks/useReplayClock.ts) → `useReplayClock`; [stateHandover.ts](../website/src/domain/demo/stateHandover.ts) → `advanceClock`. | Không. Giữ thời gian đã tích lũy trong bước; tiếp tục cộng từ đó. Riêng khi tua, giao diện hiện trạng thái hoàn tất ở bước được chọn; bấm phát tiếp tục từ bước đó; chỉ bước 1 và 2 có chuyển động truyền trạng thái. Đây là quy tắc trình chiếu, không phải phép tính RNN. |
| Các ô màu trạng thái có thật không? | [RecurrentMechanism.tsx](../website/src/components/demo/RecurrentMechanism.tsx) → `RecurrentMechanism`, `hiddenState`; [demoCopy.ts](../website/src/domain/demo/demoCopy.ts) → `stateColor`. | Mỗi ô biểu diễn một thành phần trạng thái từ checkpoint. Dữ liệu tại `read−1` là trạng thái sau bước đang đọc, tại `read−2` là trạng thái trước. Chú giải “Âm · 0 · Dương” cho biết dấu; độ đậm biểu diễn độ lớn. Không gán màu thành tăng/giảm giá hay mức tốt/xấu của mô hình. |
| Linear có xuất trực tiếp USD hoặc số sự kiện không? | [PredictionReadout.tsx](../website/src/components/demo/PredictionReadout.tsx) → `PredictionReadout`, `predictedStandardized`; [demoCopy.ts](../website/src/domain/demo/demoCopy.ts) → `OUTPUT_COPY`. | Linear biến 32 thành phần trạng thái cuối thành 1 số **đã chuẩn hóa**. Bỏ chuẩn hóa rồi hoàn nguyên: Retailrocket dùng expm1 và chặn âm ở 0; Amazon lấy giá cuối × exp(lợi suất log). Đây là kết quả checkpoint đã tính trước. |
| Công thức từng bước có khớp PyTorch không? | [export_demo.py](../website/scripts/export_demo.py) → `replay_recurrence`, `export_dataset`, `np.testing.assert_allclose`. | Bộ xuất tự tính lại `tanh(Wₓxₜ+bₓ+Wₕhₜ₋₁+bₕ)` từ `h₀=0`, rồi so với toàn bộ chuỗi trạng thái PyTorch trong sai số số thực cho phép. |
| Nguồn các phép nhân của ô 1 ở đâu? | [export_demo.py](../website/scripts/export_demo.py) → `trace_first_component`; [demoTypes.ts](../website/src/demoTypes.ts) → `calculation`, `recurrentUnit`. | Lấy hàng 0 của `weight_ih_l0` và `weight_hh_l0` từ checkpoint, nhân với đầu vào chuẩn hóa và trạng thái trước của PyTorch, xuất từng tích, hai bias, tổng và tanh. Ô 1 là `h[0]`; mô hình vẫn tính đủ 32 ô. `replay_recurrence` kiểm tra toàn vector, còn hàm này tách một ô để người xem đọc phép tính. |
| Phép tính ngay trên màn hình có dùng một mô hình khác không? | [RecurrentMechanism.tsx](../website/src/components/demo/RecurrentMechanism.tsx) → `RecurrentMechanism`; [PredictionReadout.tsx](../website/src/components/demo/PredictionReadout.tsx) → `PredictionReadout`; [export_demo.py](../website/scripts/export_demo.py) → `output_weights`, `normalization`. | Không. Sơ đồ hiện tổng các tích từ dữ liệu mới, trạng thái trước và hai bias để tính ô 1. Bảng dự đoán hiện đầu ra Linear, bỏ chuẩn hóa và đổi đơn vị bằng dữ liệu checkpoint đã xuất; không cập nhật tham số. |
| Phép tính bằng số có lộ dự đoán sớm không? | [PhasePanel.tsx](../website/src/components/demo/PhasePanel.tsx) → `PhasePanel`; [RecurrentMechanism.tsx](../website/src/components/demo/RecurrentMechanism.tsx) → `predicted`; [PredictionReadout.tsx](../website/src/components/demo/PredictionReadout.tsx) → `PredictionReadout`. | Chưa đọc đầu vào thì chưa có ví dụ tính trạng thái. Các số của dự báo cuối chỉ xuất hiện ở pha Dự đoán, sau khi đọc đủ chuỗi. Tua lùi ẩn lại đầu ra. Các phép tính nằm ngay trên màn hình, không cần mở thêm hộp thoại. |
| Làm sao biết đã dùng đúng checkpoint và đầu vào? | [export_demo.py](../website/scripts/export_demo.py) → `checkpoint_hash`, `normalized`, `arrays["x_test"][0]`, `replayed`. | Kiểm tra SHA checkpoint; tái chuẩn hóa và so với cửa sổ lưu; so dự đoán chạy lại với CSV test. Không chỉ kiểm tra hình vẽ. |
| Vì sao ví dụ này được chọn? | [export_demo.py](../website/scripts/export_demo.py) → `target_index = int(ids[0])`. | Chọn mục tiêu đầu tiên theo thứ tự thời gian trong test, không tìm mẫu RNN dự đoán đẹp nhất. Retailrocket có thể bỏ lỡ một lần tăng dù MAE toàn tập tốt hơn baseline. |
| Vì sao tách “Dự đoán”, “Thực tế”, “Toàn tập”? | [replayTimeline.ts](../website/src/domain/demo/replayTimeline.ts) → `getReplayPhase`; [PhasePanel.tsx](../website/src/components/demo/PhasePanel.tsx) → `PhasePanel`. | Đọc hết lịch sử mới hiện dự đoán, rồi hiện nhãn để so một trường hợp. Giai đoạn cuối mới dùng MAE toàn tập. Việc ẩn nhãn trên UI chỉ phục vụ trình bày; tính nhân quả được kiểm tra ở dữ liệu/exporter. |
| Các câu kết luận nằm ở đâu? | [demoCopy.ts](../website/src/domain/demo/demoCopy.ts) → `DATASET_COPY`, `compareText`, `getCaption`; [DemoSummary.tsx](../website/src/components/demo/DemoSummary.tsx) → `DemoSummary`. | Nội dung nằm riêng khỏi thuật toán phát; kết luận dựa trên MAE thật và ghi rõ giới hạn một lần thực nghiệm. |
| Ví dụ một trạng thái tính ở đâu? | [scalarRnn.ts](../website/src/domain/learning/scalarRnn.ts) → `scalarForward`, `scalarGradient`, `scalarUpdate`. | Ba số đầu vào minh họa → ba trạng thái → dự đoán → loss `½(ŷ−y)²` → BPTT → một lần SGD. Dùng chung trọng số qua ba bước và cộng đóng góp gradient từ mọi bước. |
| Tại sao ví dụ nhỏ có `½` nhưng thực nghiệm không có? | `scalarGradient`; [training.py](src/training.py) → `nn.MSELoss`. | Hệ số `½` làm đạo hàm ví dụ dễ đọc. Thực nghiệm dùng MSE của PyTorch. Không so trực tiếp trị loss hoặc độ lớn gradient của hai phần. |
| Biểu đồ loss ở phần tham khảo thuộc mô hình nào? | [TrainingHistory.tsx](../website/src/components/TrainingHistory.tsx) → `data.history.rnn`, `data.models.rnn.bestEpoch`; [Presentation.tsx](../website/src/components/Presentation.tsx) → `/data/retailrocket.json`. | Đây là lịch sử RNN Retailrocket đã lưu: chạy 40 epoch, chọn checkpoint ở epoch 34 theo validation MSE. Thanh epoch chỉ chọn phần lịch sử để xem; không học lại. MSE đo mục tiêu log1p đã chuẩn hóa, không đo số sự kiện trực tiếp. |
| Nút minh họa học lại có sửa checkpoint không? | [useTrainingReplay.ts](../website/src/components/explanations/useTrainingReplay.ts) → `useTrainingReplay`; [TrainingAnswer.tsx](../website/src/components/explanations/TrainingAnswer.tsx) → `TrainingAnswer`. | Chỉ đổi trạng thái phát của ví dụ vô hướng; tham số cập nhật minh họa thuộc ví dụ riêng. Không sửa file `.pt`, dữ liệu test hoặc dự đoán của demo chính. |
| Có kiểm chứng gradient thủ công không? | [toy_rnn.py](src/toy_rnn.py) → `manual_bptt`, `run`, `torch_loss.backward`. | So gradient BPTT thủ công với sai phân hữu hạn và autograd. Đây là kiểm chứng toán của ví dụ vô hướng, không thay thế kiểm tra mô hình 32 chiều. |


## Số liệu để đối chiếu nhanh

Đây là **RNN** trong demo chính.

| Tập | Epoch đã chạy | Epoch của checkpoint chọn | MAE RNN trên test | MAE giữ nguyên giá trị trước |
| --- | ---: | ---: | ---: | ---: |
| Retailrocket | 40 | 34 | 2,5120 sự kiện/giờ | 3,4582 sự kiện/giờ |
| Amazon | 12 | 4 | 2,2687 USD | 2,2623 USD |

Nguồn đối chiếu: [Retailrocket manifest](results/retailrocket/manifest.json), [Amazon manifest](results/amazon/manifest.json). Tìm `best_epoch`, `epochs_run`, `metrics`, `test`, `MAE`.

**Cách kết luận:** “Trên lần chia thời gian và lần huấn luyện này, RNN tốt hơn baseline giữ nguyên ở Retailrocket, nhưng chưa tốt hơn ở Amazon. Một ví dụ tốt chưa đủ kết luận; em dùng sai số trên toàn tập test. Không so MAE trực tiếp giữa hai tập vì đơn vị khác nhau.”
