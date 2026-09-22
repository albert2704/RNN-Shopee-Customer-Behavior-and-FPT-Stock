// Phần giải thích tham khảo. Hoạt ảnh hai dataset chính nằm trong components/demo/.
import { ArrowDown, ArrowRight } from 'lucide-react';
import './SequenceFlow.css';

export function RNNIntroduction() {
  return (
    <section id="reference" className="rnn-introduction" data-flow-topic>
      <p className="intro-eyebrow">Bài tập 06 · Mạng nơ-ron hồi tiếp</p>
      <h1>RNN đọc một chuỗi như thế nào?</h1>
      <p className="intro-definition">
        <strong>RNN</strong> (Recurrent Neural Network) là mạng nơ-ron xử lý dữ liệu theo thứ tự.
        Sau mỗi bước, mạng cập nhật một <strong>trạng thái</strong> để mang thông tin sang bước tiếp
        theo.
      </p>
      <div className="intro-explanation">
        <div>
          <h2>Vì sao cần xem cả diễn biến?</h2>
          <p>
            Hai chuỗi bên cạnh có cùng các số và đều kết thúc ở 20. Nhưng một chuỗi vừa giảm, còn
            chuỗi kia vừa tăng. Chỉ nhìn số cuối sẽ bỏ mất sự khác biệt này.
          </p>
          <p>
            RNN dùng dữ liệu hiện tại cùng trạng thái từ các bước trước. Trạng thái là các số do
            mạng tính ra, không phải bản sao đầy đủ của quá khứ.
          </p>
        </div>
        <div
          className="order-comparison"
          aria-label="Ví dụ minh họa thứ tự, không phải dữ liệu thực"
        >
          <div>
            <span>Vừa giảm</span>
            <p>
              10 <ArrowRight /> 20 <ArrowRight /> <strong>30</strong> <ArrowRight />{' '}
              <strong>20</strong>
            </p>
            <svg viewBox="0 0 280 70" role="img" aria-label="10, 20, 30, 20: đoạn cuối giảm">
              <path d="M10 58 L95 35 L180 12 L265 35" />
              <circle cx="265" cy="35" r="5" />
            </svg>
          </div>
          <div>
            <span>Vừa tăng</span>
            <p>
              30 <ArrowRight /> 20 <ArrowRight /> <strong>10</strong> <ArrowRight />{' '}
              <strong>20</strong>
            </p>
            <svg viewBox="0 0 280 70" role="img" aria-label="30, 20, 10, 20: đoạn cuối tăng">
              <path d="M10 12 L95 35 L180 58 L265 35" />
              <circle cx="265" cy="35" r="5" />
            </svg>
          </div>
          <small>Số minh họa. Thứ tự khác nhau có thể dẫn đến trạng thái khác nhau.</small>
        </div>
      </div>
      <div className="intro-task">
        <p>
          <strong>Tiếp theo:</strong> xem cách RNN tính trạng thái và điều chỉnh trọng số khi học.
        </p>
        <a className="flow-button" href="#learning">
          Cách RNN tính và học <ArrowDown size={18} />
        </a>
      </div>
    </section>
  );
}
