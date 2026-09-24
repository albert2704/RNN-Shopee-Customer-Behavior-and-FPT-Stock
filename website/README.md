# Sequence · Demo RNN

Website tiếng Việt dùng sau khi nhóm hoàn thành bài thuyết trình bằng slide riêng. Retailrocket và Amazon phát lại dự đoán từ checkpoint thật. Bấm **Chạy tập này** để chạy tập đang chọn đến Dự đoán. Bấm **Xem thực tế**, rồi **Xem toàn tập** khi sẵn sàng. Chọn tab Amazon để chạy tập thứ hai; mở **Tổng kết** bằng tay.

## Mở code để trả lời giảng viên

Bắt đầu ở [CODE_MAP_VI.md](../models/CODE_MAP_VI.md): sáu điểm mở code và bảng câu hỏi → file → hàm. `DemoStage.tsx` chỉ ghép giao diện; `hooks/useDemoPlayback.ts` giữ phát/dừng; `hooks/useReplayClock.ts` dùng một đồng hồ chung cho biểu đồ và trạng thái. `domain/demo/replayTimeline.ts` quy định bốn giai đoạn của demo; `domain/demo/stateHandover.ts` chia chuyển động bên trong một bước, tính đường truyền vector và cộng thời gian đã phát. `components/demo/` chứa từng phần màn hình. Ví dụ forward/BPTT/SGD độc lập nằm ở `domain/learning/scalarRnn.ts`; huấn luyện thật nằm trong `../models/src/`.

[RecurrentMechanism.tsx](src/components/demo/RecurrentMechanism.tsx) giữ sơ đồ đầu vào → RNN → trạng thái trong lượt đọc. Từ pha Dự đoán, sơ đồ thu lại để ưu tiên kết quả. **Xem phép tính** mở hộp thoại tại đúng bước và tạm dừng hoạt ảnh. [RNNCalculation.tsx](src/components/demo/RNNCalculation.tsx) giữ phép tính ô 1; [PredictionReadout.tsx](src/components/demo/PredictionReadout.tsx) giữ phép bỏ chuẩn hóa và đổi đơn vị, chỉ hiện khi đã đến pha dự đoán. Đóng hộp thoại không tự phát tiếp.

Các liên kết **Code dữ liệu**, **Code mô hình**, **Code huấn luyện** và **Code đánh giá** mở đúng file Python trên GitHub trong tab mới và tạm dừng demo. Chúng là đường dẫn đến repository hiện có, cần Internet. Khi trình bày ngoại tuyến, mở các file tương ứng trong `models/src/` trước buổi demo.

Code có chú thích tiếng Việt tại các phép tính/quyết định quan trọng. Định dạng thống nhất bằng `npm run format`; kiểm tra bằng `npm run format:check`, `npm run test:logic`, `npm run build`. `test:logic` dùng Node.js 22.18+ để đọc module TypeScript trực tiếp. ZIP source tải về có hai thư mục `models/` và `website/`, gồm mã nguồn, checkpoint, dữ liệu đã xử lý, kết quả và hướng dẫn đọc code. Hai hướng dẫn Markdown tải riêng trong mục tham khảo dùng cùng nội dung với các file gốc trong repo.

## Chạy cục bộ

Mở **[http://127.0.0.1:4173/#demo](http://127.0.0.1:4173/#demo)**. Nếu máy chủ đã dừng, chạy từ thư mục website:

```sh
npm ci
npm run build
npm run preview -- --port 4173 --strictPort
```

Node.js 20.19+ hoặc 22.12+; bản build trước được tạo bằng Node.js 26.8.1. Máy chủ chỉ nghe trên máy này; `Ctrl+C` để dừng. Khi chỉnh giao diện, dùng `npm run dev` tại cổng 5173.

Không cần tài khoản hay khóa API. Sau khi cài đặt, dữ liệu, font và tài liệu tải về được phục vụ cục bộ. Liên kết Kaggle và tài liệu bên ngoài cần Internet.

## Dùng sau phần slide

Đọc [hướng dẫn demo](PRESENTATION_GUIDE.md) và [kịch bản dành cho người demo/mở code](DEMO_BRIEFING_VI.md) trước buổi nói. Luồng tự chạy là:

1. **Retailrocket:** đọc 24 giờ hành vi đã tổng hợp, dự đoán số sự kiện giao dịch giờ tới.
2. **Amazon:** đọc lợi suất log của 30 phiên, dự đoán phiên tới rồi đổi về giá đóng cửa điều chỉnh.
3. **Tổng kết:** đối chiếu kết quả của hai thí nghiệm. Có thể mở sớm bằng nút **Tổng kết**; chọn **Xem lại demo** để về đầu một tập.

Ở mỗi tập, biểu đồ giữ nguyên vị trí; bảng bên cạnh đổi nội dung theo bốn giai đoạn: **Đọc chuỗi → Dự đoán → Thực tế và nhận xét ví dụ → MAE toàn tập kiểm tra**. Dự đoán chỉ xuất hiện sau khi đọc đủ cửa sổ. Sai số của một ví dụ và sai số trung bình của toàn tập được trình bày ở hai giai đoạn riêng để dễ phân biệt. Mỗi tập tự dừng ở Dự đoán. Hai pha cuối chỉ mở khi người trình bày bấm nút; website không tự chuyển tập.

Bảng **Đầu vào** hiện đúng quan sát đang đọc. Retailrocket có **7 giá trị**: lượt xem, thêm giỏ, giao dịch và 4 giá trị thời gian sin/cos. Amazon có **1 giá trị**: lợi suất log, hiển thị dưới dạng %. Bảng hiện các phép đo trước chuẩn hóa để dễ đọc; số đếm Retailrocket được khôi phục từ log1p. Trước bước 1, các ô chỉ hiện “—”. Giờ/ngày giữ nguyên đồng hồ nguồn; bảng không lấy nhãn tương lai hoặc sửa vector chuẩn hóa vào mô hình.

Sơ đồ cho thấy **trạng thái trước + đầu vào hiện tại → RNN → trạng thái mới**. Hai bước đầu lần lượt nhấn vào đầu vào, phần cập nhật, trạng thái vừa tạo và đường truyền trạng thái sang bước kế tiếp. Từ bước 3, bỏ chuyển động truyền vector và đổi pha nhấn sáng; biểu đồ và các giá trị vẫn cập nhật theo từng quan sát. Đầu vào cuối giữ lại trạng thái cuối để tạo dự đoán; không truyền sang một bước lịch sử thứ 25 hoặc thứ 31.

Màn hình chính ưu tiên ba câu hỏi: input là gì, dự đoán bao nhiêu, và sai số có tốt hơn baseline không. Pha Dự đoán hiện số lớn theo đơn vị gốc; pha Thực tế đặt **RNN / Thực tế / Giữ nguyên** cạnh nhau. Pha Toàn tập giữ MAE riêng với sai số của một mẫu. Phép nhân, bias, tanh và đổi đơn vị nằm trong **Xem phép tính**, dùng khi có câu hỏi. Các giá trị và checkpoint giữ nguyên.

Ở tốc độ 1×, mỗi tập mở đầu 1,2 giây. Hai bước đầu giữ 4,4 giây mỗi bước để giải thích cơ chế. Từ bước 3 đến hết cửa sổ, mỗi bước chỉ 0,25 giây. Hoạt ảnh tự dừng ở Dự đoán; bấm **Xem thực tế**, rồi **Xem toàn tập** để mở từng phần khi sẵn sàng. Không có bộ đếm thời gian ở các pha kết quả.

- **Chạy tập này** chỉ chạy tập đang chọn. **Xem thực tế** và **Xem toàn tập** mở từng pha bằng tay.
- **Tạm dừng / Tiếp tục** hoặc **Space** giữ cả vị trí đang chạy bên trong bước hiện tại; tiếp tục không bắt đầu lại toàn bộ thời lượng của bước. Space không thay thế thao tác bàn phím của ô nhập hay các điều khiển đang có focus.
- Thanh thời gian cho phép xem lại bước đã chọn; thay đổi thanh sẽ tạm dừng và hiện trạng thái hoàn tất tại bước đó. Bấm phát sẽ tiếp tục từ bước được chọn; chỉ bước 1 và 2 có chuyển động truyền trạng thái. Kéo lùi trước đầu ra sẽ ẩn lại kết quả tương lai.
- Đổi tốc độ giữ nguyên phần đã chạy. Chọn tab đưa tập đó về đầu và dừng. **Chạy lại tập này** hoặc nút biểu tượng **Chạy lại tập này từ đầu** chỉ chạy lại tập đang chọn.
- **Giải thích nhanh** mở bốn chủ đề: **Trạng thái, Trọng số, Huấn luyện, Đầu vào**. Mỗi chủ đề có một lời giải thích và hình minh họa ngắn; **Đọc giải thích đầy đủ** mở phần tham khảo có sẵn. Ví dụ học một trạng thái với chuỗi ba bước dùng phép tính riêng, không cập nhật hai mô hình thực.
- **Xem phép tính** và **Xem cách đổi đơn vị** mở chi tiết tại bước đang xem, đồng thời tạm dừng. Các số của dự báo cuối chỉ hiện sau khi đến pha **Dự đoán**, và ẩn lại khi tua lùi.
- **Giải thích nhanh** và **Dữ liệu & phép tính** tạm dừng hoạt ảnh. Đóng hộp thoại để về đúng tập và bước đang xem, vẫn ở trạng thái dừng; chỉ tiếp tục khi chủ động bấm phát.

Phần phân tích chi tiết vẫn có sẵn khi cần trả lời câu hỏi. Đây là phụ lục tùy chọn, không thuộc đường đi bắt buộc của demo. **Về demo** quay lại sân khấu chính.

## Những gì hoạt ảnh thể hiện

Trình duyệt **phát lại phép tính từ mô hình đã huấn luyện**, không huấn luyện mới. Đầu vào chuẩn hóa, trạng thái 32 chiều và dự báo phải khớp checkpoint. Trạng thái thay đổi sau mỗi quan sát; trọng số giữ nguyên trong lượt dự đoán. Trong cách triển khai của thí nghiệm này, mỗi cửa sổ bắt đầu từ trạng thái 0; đây không phải yêu cầu chung cho mọi RNN. Chú giải **Âm · 0 · Dương** giải thích dấu của từng thành phần trạng thái; độ đậm biểu diễn độ lớn. Màu không được gán thành “xu hướng”, “mùa vụ” hoặc chất lượng mô hình.

Sau trạng thái cuối, **Linear · 32 → 1** tạo một số đã chuẩn hóa. Hộp thoại phép tính hiện số này và bước đổi về đơn vị gốc: Retailrocket bỏ chuẩn hóa, hoàn tác log1p rồi chặn âm; Amazon bỏ chuẩn hóa lợi suất log rồi nhân giá cuối với exp(lợi suất). [CurrentInputs.tsx](src/components/demo/CurrentInputs.tsx) và [inputReadout.ts](src/domain/demo/inputReadout.ts) trình bày đầu vào; [PredictionReadout.tsx](src/components/demo/PredictionReadout.tsx) cùng `OUTPUT_COPY` trong [demoCopy.ts](src/domain/demo/demoCopy.ts) trình bày đường ra.

Một dự đoán chỉ minh họa cách mô hình xử lý chuỗi. Chất lượng được đánh giá bằng MAE/RMSE trên toàn test. Từ pha Dự đoán, sơ đồ được thu lại để nhường chỗ cho kết quả; nút xem phép tính và liên kết code vẫn sẵn có. Không so trực tiếp MAE giữa hai tập vì đơn vị khác nhau. Giữ nguyên giá trị gần nhất là cách dự báo đối chứng, không phải kết quả của RNN.

Retailrocket và Amazon là hai tập trong demo A6. Mỗi tập có một RNN và một GRU được huấn luyện riêng, tổng cộng bốn mạng; hoạt ảnh chính phát lại hai RNN. Retailrocket dự báo **số sự kiện giao dịch theo giờ**, không phải số đơn hàng hay hành vi của một người. Amazon dùng lợi suất làm đầu vào dù biểu đồ có thể hiển thị giá điều chỉnh.

## Dữ liệu và phụ lục

Demo chính đọc `public/data/demo.json`, chứa cửa sổ, đầu vào, trạng thái, dự báo và chỉ số toàn test của Retailrocket và Amazon; kiểu dữ liệu ở `src/demoTypes.ts`. `scripts/export_demo.py` khôi phục checkpoint, chạy lại dự đoán và kiểm chứng kết quả trước khi xuất, không huấn luyện thêm. Phần phân tích chi tiết dùng `public/data/retailrocket.json` và `public/data/amazon.json`, xuất từ `../models/results/`. Phần tham khảo đọc lịch sử huấn luyện RNN của Retailrocket từ `public/data/retailrocket.json`: 40 epoch đã chạy, checkpoint chọn ở epoch 34. Loss ở thang mục tiêu log1p đã chuẩn hóa, không phải số sự kiện.

Các lệnh tái xuất dữ liệu từ thư mục `assignment6`:

```sh
python website/scripts/export_data.py retailrocket amazon
python website/scripts/export_demo.py
python website/scripts/package_source.py
```

Phụ lục giữ nguồn, xử lý dữ liệu, split theo thời gian, biểu đồ dự báo, MAE/RMSE, lịch sử loss, mã PyTorch và ZIP thí nghiệm. Ví dụ RNN một chiều với SGD là **minh họa riêng**, khác với các mạng 32 chiều trong hoạt ảnh. Kéo epoch chỉ xem loss đã lưu, không thay checkpoint hay huấn luyện mô hình trên trình duyệt.

Retailrocket tổng hợp theo giờ UTC. Amazon giữ các phiên giao dịch, không tạo giá cho cuối tuần hoặc ngày nghỉ.

Các thí nghiệm dự báo từng bước với lịch sử đã quan sát, không tự dự báo toàn bộ tương lai. Kết quả thuộc một seed/một split; Amazon chưa có lợi thế nhất quán so với giữ nguyên giá gần nhất. Chỉ chuẩn hóa bằng tập học. Biểu đồ phụ lục có thể lấy mẫu thưa; chỉ số luôn dùng toàn test. Cửa sổ của hoạt ảnh giữ đủ các bước liên tiếp.

Nguồn: [Retailrocket](https://www.kaggle.com/datasets/retailrocket/ecommerce-dataset) — CC BY-NC-SA 4.0; [Amazon](https://www.kaggle.com/datasets/henryshan/amazon-com-inc-amzn) — Apache 2.0. JSON và ZIP giữ chi tiết nguồn/giấy phép; ZIP không chứa bản ghi khách hàng cá nhân hay thông tin sinh viên. ZIP, website và kịch bản trình bày dùng Retailrocket và Amazon.

## Kiểm tra và thiết kế

Bản điều khiển ngày 02/10/2026: 34/34 kiểm tra logic đạt, gồm dừng tại dự đoán, mở từng pha bằng tay, không tự chuyển tập và nhịp nhanh từ bước 3. Build và định dạng đạt. Kịch bản `verify-flow.mjs` đã cập nhật cho luồng mới và kiểm tra cú pháp; các ghi nhận tự chạy cả hai tập bên dưới thuộc bản cũ.

Giao diện dùng nền trắng, chữ xám và điểm nhấn xanh dương. Sơ đồ có bốn vị trí đánh số (dữ liệu → RNN → trạng thái → dự báo); nhấn sáng và lời dẫn thay đổi theo pha đang phát. Khi truyền trạng thái, vị trí nhận ở bước kế tiếp được nhấn sáng. Đường truyền nằm trong vùng sơ đồ riêng để không đi qua nút mã nguồn. Màu sắc và lời dẫn không thay đổi dữ liệu, checkpoint hoặc nhịp phát.

**Bản tập trung vào trình diễn, 01/10/2026.** 32/32 kiểm tra logic đạt. Kiểm tra trực tiếp trên trình duyệt: tự chạy 2× qua Retailrocket → Amazon → tổng kết; tua lùi; hộp thoại phép tính giữ đúng bước, không hiện dự báo sớm và đóng bằng Escape; kết quả RNN/thực tế/giữ nguyên; khung hiệu dụng 1280×720, 1024×600 và điện thoại 390×844. Không có cuộn ngang hoặc lỗi console. Các liên kết mã nguồn trỏ tới file Python hiện có trên GitHub. `verify-flow.mjs` đã cập nhật và kiểm tra cú pháp; bộ Playwright độc lập chưa chạy.

**Lịch sử kiểm tra trước bản giao diện hiện tại.**

Bản giải thích cụ thể ngày 28/09/2026: **32/32 kiểm tra logic và hợp đồng số học đạt**. Sáu kiểm tra mới dựng lại phép nhân, tổng bias và tanh của ô 1 trên đủ 54 bước; đối chiếu Linear với trạng thái cuối, rồi bỏ chuẩn hóa và đổi về đơn vị gốc. Bộ xuất kiểm tra với checkpoint; các dự báo, trạng thái gốc và chỉ số giữ nguyên, chỉ bổ sung dữ liệu giải thích.

Kiểm tra giao diện bản giải thích trực tiếp: bỏ ba nút mở giải thích trong sơ đồ; ô 1 hiển thị tổng có trọng số, bias và tanh, còn pha dự đoán hiện phép bỏ chuẩn hóa và đổi đơn vị. Đã xem ở khung hiệu dụng 953×849, 832×849, 1024×600 và chiều rộng 390px; không có cuộn ngang. Lượt tự chạy 2× đi hết Retailrocket → Amazon → tổng kết, không có lỗi console trong trang kiểm tra mới. Kịch bản `verify-flow.mjs` đã cập nhật và kiểm tra cú pháp; chưa chạy bộ Playwright độc lập.

Bản hai tập ngày 28/09/2026: 26/26 kiểm tra logic/đầu vào đạt; build và định dạng đạt. Đối chiếu với bản trước xác nhận mọi đầu vào, trạng thái, dự báo và chỉ số của Retailrocket/Amazon giữ nguyên. Kiểm tra trình duyệt trực tiếp: lượt tự chạy 2× đi từ Retailrocket qua Amazon rồi dừng ở tổng kết; hai tab phân tích và bộ chọn kết quả chỉ còn hai tập; lịch sử Retailrocket phát hết 40 epoch và ghi checkpoint tốt nhất ở epoch 34; không có lỗi console. Tổng kết vừa khung 1024×600, ở 390px không cuộn ngang. Kịch bản Playwright độc lập đã kiểm tra cú pháp, chưa chạy lại.

Đã kiểm tra trực tiếp chuyển từ bước 2 sang bước 3: vector và đường quay lại biến mất, trạng thái không còn đổi pha nhấn sáng, nội dung giải thích giữ ổn định.

Trước khi trình bày, build và kiểm tra luồng tự chạy, pause/resume giữa một chuyển động, đổi tốc độ, kéo lùi, chuyển tập, kết thúc tổng kết, hộp thoại và quay về từ phụ lục. Kiểm tra khung desktop ở độ phân giải máy chiếu và mức zoom đang dùng; điện thoại được phép xếp nội dung theo chiều dọc để giữ chữ dễ đọc. Chỉ các kết quả QA khớp revision hiện tại mới xác nhận giao diện mới; các báo cáo cũ không chứng minh luồng này đã được kiểm tra.

Font Be Vietnam Pro lưu cục bộ với giấy phép OFL trong `public/fonts/OFL.txt`.
