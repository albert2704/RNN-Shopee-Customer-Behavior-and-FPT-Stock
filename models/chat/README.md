# Chat đầu tư FPT: Neo4j + RAG + API

Mở **Chat đầu tư** ở đầu website hoặc **Mở chat đầu tư** trên trang dự báo FPT. Địa chỉ: `http://127.0.0.1:4173/#chat`.

Chat dành cho người đang cân nhắc đầu tư cổ phiếu. Mặc định, câu trả lời dùng tiếng Việt thông thường để giải thích dự báo FPT, ngày giá tham chiếu và ý nghĩa của dự báo cho một phiên kế tiếp. Trả lời thẳng câu hỏi và chỉ hỏi thêm một thông tin liên quan khi cần; không tự chuyển cuộc trò chuyện thành bài giảng mô hình hoặc bảng tính vốn.

## Chạy

Từ `assignment6/models`, dùng môi trường Python 3.12 đã có hoặc tạo bằng `python3 -m venv .venv`:

```sh
source .venv/bin/activate
python -m pip install -r chat/requirements.txt
python -m daily.pipeline bootstrap
python -m chat.setup
```

Lệnh setup yêu cầu Docker Desktop đang chạy. Nó tạo container riêng `assignment6-neo4j`, image Community `neo4j:2026.09.0`, chỉ mở cổng 7474/7687 trên loopback và giữ dữ liệu trong volume `assignment6-neo4j-data`. Mật khẩu ngẫu nhiên nằm trong `models/.env` (quyền 600). Không reset database/container đã có. Sau khi tạo, có thể dừng bằng `docker stop assignment6-neo4j`; chạy setup lại để khởi động.

Điền `OPENAI_API_KEY` trong **models/.env** bằng editor trên máy. Không gửi key trong chat, không đặt trong website, không dùng biến `VITE_*`. `.env` bị loại khỏi Git và ZIP. File mẫu `models/.env.example` chỉ có chỗ trống. Model mặc định `gpt-4.1-mini`; có thể đổi `OPENAI_MODEL` thành model Responses có structured outputs mà tài khoản API truy cập được. Việc có key chưa chứng minh key hợp lệ hoặc còn hạn mức; khi gửi thật, lỗi xác thực/hạn mức hiện rõ.

```sh
python -m daily.api
```

Tại terminal khác, từ `assignment6/website`:

```sh
npm ci
npm run build
npm run preview -- --port 4173 --strictPort
```

Vào `#chat`, bấm **Kiểm tra kết nối** sau khi thêm key. Không cần restart server để đọc key mới. Không chạy hai Python API hoặc hai website cùng cổng. Nếu API cũ đang chạy, dừng nó rồi khởi động bản có chat. Website static trên GitHub Pages không tự chạy Python/Neo4j; tính năng này cần backend cục bộ.

### Giữ website và API chạy trên Mac

Sau khi cài phụ thuộc, bootstrap và build website như trên, có thể dùng launcher từ `models/` thay cho hai terminal chạy server:

```sh
.venv/bin/python -m chat.local_site start
.venv/bin/python -m chat.local_site status
.venv/bin/python -m chat.local_site stop
```

Launcher dùng launchd trong phiên đăng nhập hiện tại để tiến trình không phụ thuộc terminal tạm của trợ lý. Không cài tự khởi động khi đăng nhập hoặc bật máy, không tự khởi động lại khi crash. Sau khi đăng xuất hoặc khởi động lại máy, chạy `start` khi cần. `stop` chỉ dừng hai dịch vụ của launcher, không dừng Neo4j. Nếu cổng đã thuộc một tiến trình khác, launcher báo xung đột thay vì tự tắt nó.

Log và cấu hình tiến trình nằm trong `models/daily/runtime/services/`, ngoài Git và ZIP. Key chỉ được Python đọc từ `.env`, không ghi vào cấu hình launchd. Launcher kiểm tra API trực tiếp và đường `/api/chat/status` qua website. Nếu mất kết nối, giao diện ghi **chưa xác nhận**, không kết luận key chưa cấu hình. Trang chat đang mở sẽ thử kết nối lại mỗi 15 giây khi chưa sẵn sàng.

## Điều gì xảy ra sau khi gửi?

1. `api.py` giới hạn origin, kích thước câu hỏi, lịch sử, tần suất và một yêu cầu đang xử lý.
2. `service.py` đọc bản FPT đang hoạt động qua `daily.pipeline.read_latest()`.
3. `evidence.py` tạo corpus có phiên bản: giá đóng cửa/dự báo, nguồn, huấn luyện, test/baseline, nhật ký và phạm vi giáo dục.
4. `graph.py` nhập các node/quan hệ vào Neo4j bằng Cypher cố định có tham số. Node gồm FPT, Forecast, Snapshot, Source, ModelRun, Evaluation, Evidence. Corpus khác phiên bản được giữ riêng. Chỉ dữ liệu tham khảo được lưu trong graph; không lưu câu hỏi, số tiền hay cuộc trò chuyện.
5. Tìm fulltext theo tiếng Việt đã bỏ dấu, rồi đọc các quan hệ Forecast → ModelRun → Evaluation và Forecast → Snapshot → Source. Đây là **RAG theo từ khóa + graph traversal**, chưa dùng embedding/vector search. Luôn lấy ngày dữ liệu, phạm vi và baseline; câu hỏi quyết định các đoạn bổ sung. Không có Cypher do LLM sinh.
6. `service.py`: `reply_mode(messages)` xác định người dùng có hỏi chi tiết kỹ thuật hoặc yêu cầu phép tính hay không. Chỉ nhắc “tôi có 200 triệu” không kích hoạt máy tính. Khi người dùng hỏi rõ số cổ phiếu mua được, `calculator.py` dùng Decimal; tiền dự phòng, giá cổ phiếu, mức lỗ hoặc cách viết mơ hồ không tự biến thành vốn đầu tư. Không tự tạo kịch bản giảm 10%/20%.
7. `prepare_evidence(evidence, data, technical=...)` chuẩn bị bằng chứng trước khi gửi cho model: mặc định tóm tắt tài liệu và graph facts bằng ngôn ngữ thông thường; câu hỏi kỹ thuật giữ các chỉ số cần đối chiếu. `service.py` gửi bằng chứng, phép tính nếu được yêu cầu và tin nhắn gần đây đến OpenAI Responses (`store=False`). Model viết câu trả lời; server kiểm tra cấu trúc và mã nguồn trích dẫn.

Giao diện chat không tự hiện bảng MAE, bảng số cổ phiếu/tiền dư hoặc bảng giảm giá chỉ vì người dùng nêu vốn. Khi hỏi rõ chỉ số sai số, RNN hoặc baseline, câu trả lời dùng số liệu thật từ kết quả đã lưu; câu hỏi thông thường về độ tin cậy được giải thích bằng lời. **Nguồn tham khảo** là phần tham khảo phụ, mặc định thu gọn, mở khi muốn đối chiếu. Các nút hỏi tiếp là câu người dùng có thể hỏi trợ lý, không yêu cầu trợ lý tự biết sở thích cá nhân.

RAG giúp câu trả lời có nguồn nhưng không đảm bảo mọi cách diễn đạt đều chính xác. Prompt hướng dẫn model không bịa giá/fundamentals/mã khác, không biến một dự báo thành lợi nhuận dài hạn hoặc xác suất tăng. Câu trả lời mặc định không tự trích MAE hoặc so sánh baseline; khi người dùng hỏi kỹ thuật, kết quả test phải được giải thích đúng ngay cả khi RNN kém baseline.

## Câu hỏi demo

- “Tôi có 200 triệu, nên đầu tư như thế nào?” — trả lời thực tế dựa trên dự báo FPT có ngày tham chiếu; hỏi một thông tin còn thiếu, ví dụ thời hạn đầu tư. Không tự tính số cổ phiếu hoặc hiện MAE.
- “Dùng 100 triệu mua FPT thì được bao nhiêu cổ phiếu?” — số học theo giá đóng cửa có ngày, chưa tính phí/thuế/trượt giá/lô giao dịch; không phải lệnh mua hay tỷ trọng đề xuất.
- “RNN có tốt hơn giữ giá phiên trước không?” — đối chiếu MAE test và nguồn.
- “Mai chắc chắn tăng chứ?” — một phiên dự báo không bảo đảm kết quả.
- “Nên mua FPT, VNM hay HPG?” — dataset hiện chỉ có FPT, chưa đủ để xếp hạng.
- “Giá này đã điều chỉnh cổ tức chưa?” — nguồn chưa xác nhận rõ cách điều chỉnh.

Ví dụ chỉ khi được hỏi rõ “50 triệu mua được bao nhiêu cổ phiếu FPT theo giá đã lưu?”: ở snapshot 06/10/2026, tham chiếu 60.400 VND, phép tính cho 827 cổ phiếu nguyên, chi 49.950.800 VND và còn 49.200 VND, trước phí/thuế/trượt giá và quy định lô. Đây là minh họa số học, không phải đề xuất dùng hết vốn. Khi cập nhật giá, phép tính dùng giá tham chiếu mới.

## Kiểm tra

```sh
python -m pip install -r daily/requirements-test.txt
python -m unittest chat.test_chat daily.test_daily -v
A6_TEST_NEO4J=1 python -m unittest chat.test_chat.ChatTests.test_live_graph_refresh_paths_remain_scoped -v
```

Test mặc định không gọi API có phí. Test Neo4j dùng ID riêng và dọn riêng dữ liệu thử; kiểm tra cả trường hợp raw source và lịch sử cũ đổi trong khi forecast ID không đổi. Cần gửi câu hỏi thật sau khi cấu hình key để xác nhận chất lượng câu trả lời từ model. Thiếu key hoặc graph phải báo lỗi rõ, không thay bằng câu trả lời soạn sẵn và gắn nhãn AI.

Yêu cầu nghiệm thu bổ sung sau điều chỉnh hướng tới khách hàng: câu hỏi 200 triệu không kích hoạt phép tính hoặc thuật ngữ kỹ thuật; câu hỏi rõ số cổ phiếu mới dùng máy tính; câu hỏi kỹ thuật vẫn nhận đúng chỉ số và nguồn; mỗi lượt chỉ hỏi thêm một thông tin liên quan và không hỏi lại điều đã biết. Các kiểm tra lịch sử trong `models/docs/specs/0002-fpt-chat.md` thuộc giao diện trước điều chỉnh, không xác nhận các yêu cầu mới này đã đạt.

Hội thoại nằm trong bộ nhớ React, được giữ khi mở dữ liệu FPT rồi quay lại, mất khi reload hoặc bấm cuộc trò chuyện mới. Mỗi lần gửi chuyển tối đa 15 tin gần nhất, tối đa 24.000 ký tự đến API; không có kho lịch sử trên server. `store=False` tắt lưu Response để truy xuất sau, không phải cam kết không lưu dữ liệu theo mọi chính sách của nhà cung cấp. Dùng một process Uvicorn trên localhost; public hosting cần thiết kế xác thực và hạn mức riêng.

Tài liệu: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Neo4j fulltext](https://neo4j.com/docs/cypher-manual/current/indexes/semantic-indexes/full-text-indexes/), [khung thời hạn và rủi ro](https://www.investor.gov/introduction-investing/getting-started/asset-allocation).


## Góc nhìn một, ba và sáu tháng

`outlook.pipeline` huấn luyện ba RNN riêng cho 21, 63 và 126 phiên, xấp xỉ 1/3/6 tháng. Mỗi mô hình đọc 60 log return và dự báo trực tiếp mức thay đổi của cả thời hạn. Không nhân lặp dự báo một phiên. Chạy từ `models/`:

```sh
.venv/bin/python -m outlook.pipeline train --snapshot daily/runtime/snapshots/<snapshot-id>
```

Chỉ lệnh train huấn luyện. Nút cập nhật giá chạy suy luận bằng trọng số đã lưu cho cả dự báo một phiên và theo tháng. API `GET /api/fpt/outlook` và chat từ chối ghép dự báo tháng với giá khác ngày, giá mốc hoặc SHA của lịch sử. Khi clone, checkpoint, metadata và bản dự báo tháng đi kèm được dùng; dữ liệu giá gốc không nằm trong ZIP.

`chat/company_evidence.json` lưu tám đoạn thông tin từ các công bố chính thức của FPT, có ngày nguồn, kỳ thông tin và URL. Đây là bộ nguồn được kiểm tra thủ công tới 07/10/2026, không phải dịch vụ tin tức tự cập nhật. Phải phân biệt doanh thu/hợp đồng, kế hoạch/kết quả, và cơ sở kế toán thay đổi với FPT Telecom. Xem `company_evidence.md` để kiểm tra nguồn/ngày.

`chat/investment.py` gắn dự báo tương thích và nguồn doanh nghiệp; `evidence.corpus` đưa chúng vào phiên bản corpus. Neo4j có HorizonForecast → ModelRun và Evidence → Publication → FPT. H1/H3/H6 là nguồn dự báo; B1–B8 là nguồn doanh nghiệp. `requested_horizon` giữ thời hạn do người dùng nêu, không lấy gợi ý của trợ lý làm sở thích của họ.

Chat có thể đưa nhận định có điều kiện cho sáu tháng, kết hợp đúng dự báo H6 và công bố doanh nghiệp, nêu điều hỗ trợ, rủi ro và điều cần theo dõi. Cả ba mô hình hiện kém cách giữ nguyên giá trên kiểm tra, nên không dùng riêng điểm dự báo dương để khuyến nghị mua. Bản sáu tháng chỉ có hai giai đoạn test không chồng lấp; chúng không được coi là các quan sát độc lập về thống kê. Dữ liệu công ty không phải đầu vào của RNN, chỉ dùng trong phần tổng hợp của chatbot.

Câu hỏi demo: “Tôi có 200 triệu, định đầu tư FPT trong 6 tháng. Bạn khuyên thế nào?”; “Những điều gì có thể làm bạn thay đổi nhận định?”; “Nếu mô hình dự báo tăng thì có chắc chắn có lãi không?”. MAE vẫn chỉ xuất hiện khi được hỏi rõ.
