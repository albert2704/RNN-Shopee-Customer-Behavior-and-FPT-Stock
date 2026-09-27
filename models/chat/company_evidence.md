# Ghi chú kiểm chứng nguồn doanh nghiệp FPT

Ngày rà soát và giới hạn thông tin: **07/10/2026**. `company_evidence.json` chỉ chứa diễn giải ngắn từ các trang chính thức của FPT; không có giá mục tiêu của bên phân tích. Ngày đăng và kỳ số liệu là hai trường riêng. Kết quả kinh doanh, nhận diện rủi ro và phê duyệt phương án doanh nghiệp không tự chứng minh lợi nhuận đầu tư hoặc mức định giá phù hợp.

| Mã | Ngày đăng dùng trong JSON | Cơ sở kiểm chứng |
| --- | --- | --- |
| B1 | 10/04/2026 | Ngày hiển thị trên thông báo công bố Báo cáo thường niên 2025; chỉ lấy doanh thu và lợi nhuận sau thuế của cả năm 2025. |
| B2 | 03/10/2026 | Ngày bài viết chính thức; đoạn kết quả chỉ bao phủ tám tháng đầu năm 2026. |
| B3 | 04/10/2026 | Ngày bài viết chính thức; số liệu Dịch vụ CNTT nước ngoài được nêu cho sáu tháng đầu năm. |
| B4 | 24/08/2026 | Ngày bài viết chính thức; đoạn doanh thu thuộc bảy tháng đầu năm. |
| B5–B7 | 08/04/2026 | Ngày FPT liệt kê Báo cáo thường niên 2025 bản digital và Báo cáo ESG trong mục công bố thông tin. Các trang chương riêng không hiển thị ngày đăng độc lập. |
| B8 | 16/04/2026 | Ngày bài viết về ĐHĐCĐ; văn bản mô tả phê duyệt và lịch dự kiến, không được nâng thành xác nhận hoàn tất. |

Ngày 08/04/2026 của B5–B7 dựa trên nhãn **Updated** tại [danh mục công bố chính thức](https://fpt.com/en/ir/information-disclosures), không phải timestamp riêng của từng trang chương. [Thông báo ngày 10/04/2026](https://fpt.com/vi/tin-tuc/fpt-cong-bo-bao-cao-thuong-nien-2025) cũng xác nhận báo cáo đã công bố. Nếu cần truy vết thay đổi từng phiên bản trang, phải bổ sung bản lưu có hash; bộ này ghi nhận nguồn được đọc tại ngày rà soát.

Tám tháng đầu năm là kỳ kết quả mới nhất đã xác minh trong nghiên cứu này. Không khẳng định đây là báo cáo mới nhất tuyệt đối; không suy diễn thành kết quả quý III. Trang danh mục còn liệt kê báo cáo kết quả phát hành ngày 25/09/2026 và cập nhật vốn ngày 07/10/2026, nhưng nội dung tài liệu đính kèm chưa được đọc nên không dùng để khẳng định số lượng phát hành hoặc ngày hoàn tất trong corpus.

B7 là điều kiện bắt buộc khi đặt số liệu 2025 cạnh 2026. Các tỷ lệ tăng trưởng trong B2–B4 được giữ nguyên theo công bố của FPT; không tự tính lại trên hai bộ số liệu có cơ sở hợp nhất khác nhau. Không dùng các tài liệu này để xác nhận cách điều chỉnh cổ tức/chia tách của chuỗi giá KBS.

Mọi `source_url` trong JSON đã được mở hoặc truy xuất nội dung qua tìm kiếm web tại nguồn chính thức. Các URL PDF tìm kiếm được nhưng mở trả lỗi không được dùng làm nguồn trong JSON. Nguồn có hai tài liệu B5/B6 được diễn giải tổng cộng dưới 200 từ; các nguồn còn lại mỗi nguồn dưới 200 từ.
