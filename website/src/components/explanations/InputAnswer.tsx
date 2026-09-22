import { ArrowRight } from 'lucide-react';
import type { DemoDataset, DemoDatasetId } from '../../demoTypes';

interface InputDescription {
  description: string;
  features: string[];
  limitation: string;
}

// Tách nội dung theo tập để phân biệt đại lượng trên biểu đồ với đầu vào
// thật của mạng. Đặc biệt, biểu đồ Amazon là giá nhưng mạng đọc log return.
const inputContent: Record<DemoDatasetId, InputDescription> = {
  retailrocket: {
    description:
      'Mỗi giờ, RNN nhận số lượt xem, thêm vào giỏ, giao dịch và thông tin giờ, thứ. Biểu đồ chỉ vẽ số sự kiện giao dịch.',
    features: ['Lượt xem', 'Thêm vào giỏ', 'Giao dịch', 'Giờ và thứ: 4 giá trị sin/cos'],
    limitation:
      'Đếm sự kiện giao dịch, không phải số đơn hàng duy nhất hay xác suất mua. Dự đoán có thể là số thập phân.',
  },
  amazon: {
    description:
      'Biểu đồ hiển thị giá đóng cửa điều chỉnh bằng USD. RNN nhận mức thay đổi giá giữa hai phiên, tính bằng log(Pₜ/Pₜ₋₁).',
    features: ['1 giá trị: mức thay đổi giá theo log'],
    limitation:
      'Đầu ra được đổi từ mức thay đổi về giá USD. Dữ liệu là giá lịch sử đã điều chỉnh; kết quả này không phải kiểm thử chiến lược giao dịch.',
  },
};

export default function InputAnswer({ data }: { data: DemoDataset }) {
  const retail = data.id === 'retailrocket';
  const amazon = data.id === 'amazon';
  const { description, features, limitation } = inputContent[data.id];

  return (
    <>
      <h3>
        {data.title}: {data.lookback} {data.stepUnit} trước để dự đoán {amazon ? 'phiên' : 'giờ'}{' '}
        tiếp theo
      </h3>
      <p className="quick-lead">{description}</p>

      <div className="quick-input-features">
        {features.map((feature) => (
          <span key={feature}>{feature}</span>
        ))}
      </div>

      <div className="quick-input-flow">
        <div>
          <strong>
            {data.lookback} × {data.inputSize}
          </strong>
          <span>{data.stepUnit} × giá trị mỗi bước</span>
        </div>
        <ArrowRight className="quick-flow-arrow" aria-hidden="true" />
        <div>
          <strong>Chuẩn hóa</strong>
          <span>Dùng thống kê tập học</span>
        </div>
        <ArrowRight className="quick-flow-arrow" aria-hidden="true" />
        <div className="quick-input-rnn">
          <strong>RNN</strong>
          <span>{data.hiddenSize} giá trị trạng thái</span>
        </div>
        <ArrowRight className="quick-flow-arrow" aria-hidden="true" />
        <div>
          <strong>{amazon ? 'Phiên tới' : 'Giờ tới'}</strong>
          <span>Đổi về {data.unit}</span>
        </div>
      </div>

      <p className="quick-note">
        {retail && 'Ba loại số đếm được biến đổi bằng log(1 + x) trước khi chuẩn hóa. '}
        {limitation}
      </p>
      <p className="quick-source-note">
        Chỉ dùng lịch sử đã quan sát. Demo dùng mốc đầu tiên của tập kiểm tra, không chọn theo sai
        số.
      </p>
    </>
  );
}
