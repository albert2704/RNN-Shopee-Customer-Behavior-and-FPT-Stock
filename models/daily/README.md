# FPT: lấy giá đóng cửa và dự báo phiên kế tiếp

Phần này chạy Python thật khi bấm **Dự báo FPT → Cập nhật & dự báo** trên website. Màn hình `#demo` vẫn phát lại thí nghiệm Kaggle để trình bày RNN từng bước.

## Chạy bản đã huấn luyện

Từ thư mục `assignment6/models`, dùng Python 3.12 trở lên:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r chat/requirements.txt
python -m daily.pipeline bootstrap
python -m daily.api
```

`bootstrap` kiểm tra checkpoint rồi kích hoạt bản đóng gói, không ghi đè mô hình đã có. Dịch vụ chạy tại `127.0.0.1:8006`. Giữ terminal này mở. Tại terminal khác, từ `assignment6/website`:

```sh
npm ci
npm run build
npm run preview -- --port 4173 --strictPort
```

Mở `http://127.0.0.1:4173/#fpt-daily`. Vite chuyển `/api` đến Python. Khi Python chưa chạy, website hiển thị bản đã lưu, ghi rõ ngày dữ liệu. Nút cập nhật cần Python và kết nối mạng. Bản static trên GitHub Pages không tự chạy PyTorch.

## Lấy dữ liệu và huấn luyện một lần mới

Từ `models/`, trong môi trường Python ở trên:

```sh
python -m daily.pipeline fetch
python -m daily.pipeline train --snapshot daily/runtime/snapshots/<snapshot-id>
```

Hoặc `python -m daily.pipeline train` để lấy dữ liệu rồi train. Mỗi lần tạo thư mục run riêng. Muốn lấy giá và suy luận bằng mô hình đã lưu, dùng `python -m daily.pipeline refresh`. Không có scheduler ngầm: cập nhật khi bấm nút hoặc chạy lệnh, không tự huấn luyện mỗi ngày.

Nguồn là **KBS qua Vnstock Community 4.0.9**, `Market().equity('FPT').ohlcv(..., source='kbs', interval='1D', count=10000)`. `count` được đặt rõ vì mặc định chỉ trả 100 dòng. Community giới hạn lịch sử tối đa tám năm; chương trình yêu cầu từ đầu năm cách hiện tại bảy năm. Giá stock của adapter KBS là nghìn VND, được nhân 1.000. Vnstock có thể tạo cache dưới `~/.vnstock`; chương trình tắt telemetry và thiết lập hướng dẫn AI tự động. Không cần ghi API key vào code.

Không trộn CSV Kaggle cũ vào nguồn mới. KBS không công bố cờ điều chỉnh doanh nghiệp trong adapter này; giữ giá nguồn và ghi rõ điều đó. Nếu nguồn sửa giá mốc cũ sau cổ tức/chia tách, nhật ký không chấm sai số giữa hai cơ sở giá khác nhau.

Ngày hiện tại chỉ được dùng sau 16:00 giờ Việt Nam. Đây là mốc lấy dữ liệu thận trọng, không phải cam kết nguồn đã hoàn tất dữ liệu. Không tạo ngày nghỉ, không lấy ngày tương lai. Đích là **phiên được ghi nhận kế tiếp**, không đoán ngày nghỉ bằng cách cộng một ngày.

## Huấn luyện và bằng chứng

31 giá đóng cửa tạo 30 log return. Đầu vào `(N,30,1)`, đích là log return phiên sau. Chia theo thời gian đích 70% train, 15% validation, 15% test. Scaler chỉ fit trên train. RNN một lớp, hidden size 32, seed 42, Adam 0,001, batch 64, tối đa 40 epoch, patience 8. Chọn checkpoint bằng validation MSE; test không dùng để chỉnh cấu hình.

Run đầu tiên `20261007T114039-e90d31` dùng 1.935 phiên, từ 02/01/2019 đến 06/10/2026. Bỏ dòng 07/10 vì phiên chưa kết thúc khi lấy dữ liệu. Train 1.332 mục tiêu, validation 285, test 287. Chạy 18 epoch, chọn epoch 10.

| Kiểm tra 11/08/2025 đến 06/10/2026 | MAE (VND) | Đúng chiều |
| --- | ---: | ---: |
| RNN | 1.184,56 | 44,95% |
| Giữ giá phiên trước | 1.174,18 | 2,09% |
| Lặp lợi suất phiên trước | 1.644,38 | 49,48% |

Đúng chiều dùng ba nhãn tăng/giảm/không đổi. Baseline giữ giá luôn đoán không đổi nên chỉ đúng 6/287 phiên; không dùng con số này để tuyên bố RNN tốt hơn. RNN hiện chưa vượt baseline về MAE hoặc baseline lặp chiều về độ đúng chiều. Đây là một seed và một lần chia dữ liệu, không phải bằng chứng đầu tư sinh lời.

`artifacts/<run-id>/` giữ checkpoint, manifest, CSV dự đoán, lịch sử loss và mã thực thi để đọc và kiểm tra. `runtime/` chứa bản dữ liệu gốc, snapshot đầy đủ, run đang dùng và nhật ký, bị loại khỏi Git/ZIP. Các snapshot giữ nguyên ngày lấy dữ liệu và hash. Nguồn có thể điều chỉnh lịch sử, nên lần tải lại sau này không đảm bảo cùng hash. Muốn tái lập tuyệt đối, giữ snapshot cục bộ ban đầu.

## Kiểm chứng

```sh
python -m pip install -r daily/requirements-test.txt
python -m unittest daily.test_daily -v
python -m daily.audit
```

Audit đầy đủ cần snapshot của run đã train tại máy này. Bản bootstrap chỉ có checkpoint/kết quả/mã, không có CSV gốc. Audit đối chiếu hash, tính thủ công RNN bằng NumPy và tính lại toàn bộ metric validation/test. Sai khác giá tối đa trong lần kiểm tra đầu dưới 0,001 VND.

## Đọc code

- `provider.py`: lấy KBS, đổi đơn vị, bỏ phiên chưa hoàn thành, lưu nguồn/hash.
- `core.py`: làm sạch, cửa sổ nhân quả, scaler, metric và đầu vào suy luận.
- `pipeline.py`: gọi trainer chung, lưu run độc lập, nạp checkpoint, dự báo và nhật ký.
- `api.py`: GET bản đã lưu, POST cập nhật với timeout, khóa một tiến trình và hạn chế tần suất.
- `../src/training.py`: MSE, backward, Adam, chọn checkpoint.
- `../../website/src/components/DailyForecast.tsx`: giá, dự báo, bằng chứng test và lỗi nguồn.

API chỉ dành cho máy cục bộ, một process Uvicorn. Không có lệnh mua bán. API cũng phục vụ chatbot FPT; xem `../chat/README.md` để cấu hình Neo4j và API key. Riêng các lệnh train/fetch không dùng chat có thể cài `daily/requirements.txt`.

Nguồn: https://www.vnstocks.com/docs/vnstock/du-lieu-thi-truong-market-data
