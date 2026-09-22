import { ArrowRight } from 'lucide-react';

/** Phân biệt việc học tham số với việc dùng tham số để dự đoán một chuỗi. */
export default function WeightsAnswer() {
  return (
    <>
      <h3>Trạng thái thay đổi, trọng số chỉ đổi khi học</h3>
      <p className="quick-lead">
        Trọng số là các hệ số quyết định cách kết hợp đầu vào và trạng thái. Mô hình học các hệ số
        này từ những chuỗi đã có đáp án.
      </p>

      <div className="quick-weight-cards">
        <article>
          <span className="quick-card-label">Khi huấn luyện</span>
          <h4>Điều chỉnh trọng số</h4>
          <div className="quick-small-flow">
            <span>Dự đoán</span>
            <ArrowRight aria-hidden="true" />
            <span>So với đáp án</span>
            <ArrowRight aria-hidden="true" />
            <b>Cập nhật W</b>
          </div>
          <p>Sai số giúp tính hướng điều chỉnh các tham số, gồm trọng số và độ lệch b.</p>
        </article>

        <article className="quick-inference-card">
          <span className="quick-card-label">Khi dự đoán · demo đang xem</span>
          <h4>Giữ nguyên trọng số</h4>
          <div className="quick-small-flow">
            <span>xₜ + hₜ₋₁</span>
            <ArrowRight aria-hidden="true" />
            <b>hₜ mới</b>
          </div>
          <p>Cùng một RNN được dùng ở mọi bước. Chỉ đầu vào và trạng thái thay đổi theo chuỗi.</p>
        </article>
      </div>

      <p className="quick-note">
        Hoạt ảnh phát lại phép tính của mô hình đã huấn luyện; mô hình không học lại khi bạn bấm
        phát.
      </p>
    </>
  );
}
