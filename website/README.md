# Website demo RNN

Cloud: [Vercel + Render + Neo4j Aura](../models/hosting/README.md). `VITE_API_BASE_URL` chỉ chứa địa chỉ API công khai; không đặt key trong frontend.

Website giới thiệu hai bài toán: **Shopee Thailand (mô phỏng)** dự báo số đơn ngày mai, và **FPT** dự báo giá đóng cửa phiên sau. Mỗi tập có RNN và GRU được huấn luyện riêng. Hoạt ảnh chính phát lại hai RNN từ checkpoint; website không học thêm hoặc chạy PyTorch trong trình duyệt.

## Chạy

```sh
npm ci
npm run build
npm run preview -- --port 4173 --strictPort
```

Mở [demo](http://127.0.0.1:4173/#demo). Có thể dùng `npm run dev -- --port 4173 --strictPort` khi sửa mã. Chỉ chạy một server trên cùng cổng.

## Giao diện và luồng trình bày

Thiết kế theo bản bàn giao trong [DESIGN.md](DESIGN.md), với kiểu chữ sans-serif theo yêu cầu mới: IBM Plex Sans cho tiêu đề, số liệu, logo và nội dung, nền giấy, đường kẻ mảnh và điểm nhấn đỏ cam. Màn hình từ 900 px dùng sân khấu 1600 × 900, thu phóng đồng đều để vừa khung trình chiếu. Màn hình nhỏ hơn chuyển sang bố cục cuộn dọc.

Thanh chương đi theo thứ tự **01 Shopee Thailand → 02 FPT → 03 Tổng kết → 04 Hỏi đáp**. **Phụ lục** chứa dữ liệu lịch sử, cách chia tập và kết quả mô hình. Các địa chỉ tương ứng là `#demo`, `#fpt`, `#tong-ket`, `#hoi-dap` và `#phu-luc`. Các địa chỉ cũ `#du-bao`, `#fpt-daily` và `#chat` chuyển tới Hỏi đáp; `#explore-*` chuyển tới Phụ lục.

Bấm **Chạy tập này** để đọc lịch sử của tập đang chọn. Hai quan sát đầu giữ nhịp chậm để giải thích dữ liệu mới, trạng thái trước và trạng thái mới. Từ quan sát 3, các giá trị cập nhật nhanh. Demo tự dừng ở **Dự đoán**.

Bấm **Xem thực tế**, rồi **Xem toàn tập** bằng tay. Sau đó, nút chính chuyển từ Shopee sang FPT ở bước 0 và tạm dừng, hoặc từ FPT sang Tổng kết. Chọn chương dữ liệu trên thanh đầu trang luôn đặt lại tập đó. Nút quay lại **02 FPT** ở Tổng kết khôi phục màn hình kết quả toàn tập.

**Space** phát/dừng trong pha đọc và mở pha tiếp theo ở pha kết quả. Ở các chương khác, **Space** hoặc **→** sang chương sau, **←** về chương trước. Các phím này không can thiệp khi đang nhập chat, điều khiển nút/thanh tua hoặc mở hộp thoại. Thanh thời gian chỉ tua tới dự đoán; hai pha kết quả cần bấm nút. Tua lùi ẩn dự đoán và đáp án. Đổi tốc độ giữ phần đã chạy. Nút chạy lại chỉ chạy tập đang chọn.

Các hộp thoại **Giải thích nhanh** và **Xem phép tính** tạm dừng hoạt ảnh. Đóng hộp thoại giữ đúng bước và trạng thái dừng. Phụ lục có thể mở phần dữ liệu và công thức chi tiết. Trạng thái mới trở thành trạng thái trước ở bước kế tiếp; cùng trọng số được dùng ở mọi bước suy luận. Hai bước đầu hiển thị đường chuyển vector trạng thái; chế độ giảm chuyển động giữ các giá trị tĩnh đầy đủ.

## Dữ liệu thật của mô hình

`public/data/demo.json` chứa cửa sổ test đầu tiên, các vector x và h, trọng số cho phép tính, dự đoán, nhãn và MAE/RMSE toàn test. `scripts/export_demo.py` kiểm tra checkpoint SHA, NPZ, CSV, từng trạng thái và phép hoàn nguyên trước khi xuất.

Shopee: 30 ngày × 5 số đếm qua log1p, gồm session bắt đầu, thăm trang sản phẩm, giỏ, thanh toán và đơn hàng. Cả 5 số được chuẩn hóa bằng train. Giữ ngày nguồn; múi giờ không được publisher ghi rõ. Đây là 100% mô phỏng Thailand từ một tác giả độc lập, không phải dữ liệu chính thức hay dữ liệu Việt Nam. Lượt thăm trang giỏ không phải sự kiện thêm sản phẩm vào giỏ.

FPT: 30 phiên × 1 log return chuẩn hóa. Biểu đồ vẽ giá VND; đầu ra đổi về giá bằng giá phiên cuối × exp(log return). Nguồn có Close, không có Adj Close hay phương pháp điều chỉnh.

Trạng thái có 32 thành phần, bắt đầu bằng 0 ở mỗi cửa sổ. Các ô màu mã hóa dấu và độ lớn, không được đặt nghĩa như “xu hướng”. Linear dùng trạng thái cuối để tạo một số chuẩn hóa. Shopee bỏ chuẩn hóa rồi dùng expm1 và chặn âm; FPT hoàn nguyên lợi suất rồi đổi về giá.

## Kết quả và nguồn

| Tập | Test | MAE RNN | MAE giữ nguyên | Đơn vị |
| --- | ---: | ---: | ---: | --- |
| Shopee Thailand, mô phỏng | 216 | 309,75 | 141,56 | đơn/ngày |
| FPT | 389 | 1.059,92 | 1.053,73 | VND/cổ phiếu |

RNN chưa tốt hơn cách giữ nguyên về MAE trên cả hai tập. Không so trực tiếp MAE khác đơn vị. Một trường hợp tốt chưa đủ kết luận. Kết quả thuộc một seed và một split; không chỉnh cấu hình theo test.

Nguồn: [Shopee Thailand](https://www.kaggle.com/datasets/hninshwezinhlaing/shopee-th-customer-journey-and-operations-dataset), Hnin Shwe Zin Hlaing, CC BY-SA 4.0; [FPT](https://www.kaggle.com/datasets/thangtranquang/stock-vn30-vietnam), Thang Tran, CC0. ZIP giữ nguồn và giấy phép; chỉ chứa dữ liệu tổng hợp, không chứa CSV gốc hoặc ID khách hàng.

`public/data/shopee.json` và `public/data/fpt.json` phục vụ phân tích chi tiết. Lịch sử RNN Shopee có 19 epoch, checkpoint ở epoch 11. Thanh epoch chỉ xem lịch sử đã lưu. Ví dụ scalar ba bước và SGD là phần minh họa độc lập.

Tái xuất từ thư mục repository:

```sh
python website/scripts/export_data.py shopee fpt
python website/scripts/export_demo.py
python website/scripts/package_source.py
```

Sau khi thay dữ liệu hoặc ZIP, build lại để `dist/` chứa bản mới.

## Kiểm tra

```sh
npm run test:logic
npm run build
npm run format:check
```

45 kiểm tra logic bao gồm điều khiển, đầu vào, phép tính checkpoint, kết nối chat, đối chiếu nguồn dự báo dài hạn và định tuyến chương. Kiểm toán Python riêng xác nhận mọi cửa sổ, dự đoán, metric và phép tổng hợp CSV gốc. `npm run test:flow` và `npm run test:ui` chạy bộ kiểm tra trình duyệt cho giao diện mới trên server đang hoạt động ở cổng 4173 (hoặc `SITE_URL`). Bộ kiểm tra trình duyệt chưa được chạy cho bản thiết kế này. Không dùng báo cáo UI của phiên bản cũ để xác nhận bản mới.

Các liên kết code giữ URL repository GitHub hiện có. Chỉ phản ánh mã mới sau khi push. IBM Plex Sans và IBM Plex Mono được lưu cục bộ cùng giấy phép OFL trong `public/fonts/editorial/`, nên không cần tải font từ Internet khi trình bày. Font Be Vietnam Pro của phần tham khảo cũ vẫn có giấy phép tại `public/fonts/OFL.txt`.

## Chat đầu tư

Chương **04 Hỏi đáp** mở `#hoi-dap`. Đây là cuộc trò chuyện cho người đang cân nhắc đầu tư cổ phiếu, dùng dữ liệu FPT, Neo4j và OpenAI API để trả lời có nguồn. Mặc định giải thích dự báo, ngày giá tham chiếu và ý nghĩa một phiên bằng tiếng Việt thông thường; chỉ hỏi thêm một thông tin liên quan khi cần. Không tự hiện MAE, bảng vốn/tiền dư hoặc kịch bản giảm giá. Không thay thế bằng câu trả lời soạn sẵn khi thiếu key. Thiết lập từ `models/` theo [hướng dẫn chat](../models/chat/README.md); dùng `chat/requirements.txt` cho API có cả dự báo và chat. Key nằm ở `models/.env`, không ở browser hoặc ZIP.

Trên Mac, sau khi build, có thể giữ website và API chạy bằng `.venv/bin/python -m chat.local_site start` từ `models/`; dùng `status` để kiểm tra và `stop` để dừng hai dịch vụ. Không cần giữ terminal tạm mở. Launcher không tự khởi động lúc đăng nhập hoặc bật máy. Nếu API không phản hồi, UI ghi **chưa xác nhận** cho key/Neo4j; chỉ ghi thiếu cấu hình khi nhận được kết quả kiểm tra thật.

Hội thoại được giữ khi chuyển giữa các chương; reload hoặc **Cuộc trò chuyện mới** sẽ xóa khỏi bộ nhớ. Khi có câu trả lời mới, khung chat cuộn tới đầu câu trả lời đó. API chỉ nhận các tin gần đây trong giới hạn. Với câu “Tôi có 200 triệu, nên đầu tư như thế nào?”, số vốn là ngữ cảnh, không tự kích hoạt máy tính. Chỉ câu hỏi rõ số cổ phiếu mua được mới dùng phép tính Decimal; câu hỏi kỹ thuật vẫn có thể xem chỉ số test và baseline. **Nguồn & cách tìm câu trả lời** mặc định thu gọn để mở đối chiếu khi cần. Bộ mã nguồn đi kèm chứa `models/chat/` và `StockChat.tsx`.

Các kết quả kiểm tra trước điều chỉnh giao diện chat không xác nhận luồng khách hàng mới. Nghiệm thu bổ sung phải kiểm tra trả lời thông thường không có MAE/phép tính tự động, câu hỏi tính toán và kỹ thuật được phân biệt đúng, cùng khả năng nhớ thông tin đã trao đổi; xem yêu cầu tại `../models/docs/specs/0002-fpt-chat.md`.


## Dữ liệu dự báo dùng cho chat

Giao diện chỉ có hai demo, Tổng kết, Hỏi đáp và Phụ lục. Dịch vụ Python và các mô hình dự báo FPT vẫn cung cấp ngữ cảnh cho chatbot: dự báo phiên kế tiếp và ba mốc 21/63/126 phiên (xấp xỉ 1/3/6 tháng). Xem `../models/daily/README.md` và `../models/outlook/README.md` để cập nhật dữ liệu hoặc huấn luyện. Cả ba mô hình dài hạn hiện chưa tốt hơn cách giữ nguyên giá trong lần kiểm tra đã lưu. Python API chạy trên `127.0.0.1:8006`; Vite dev/preview proxy `/api` đến đó. Chat không hoạt động chỉ bằng GitHub Pages.
