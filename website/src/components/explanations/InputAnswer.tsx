import { ArrowRight } from 'lucide-react';
import type { DemoDataset, DemoDatasetId } from '../../demoTypes';

interface InputDescription {
  description: string;
  features: string[];
  limitation: string;
}

// Tách nội dung theo tập để phân biệt đại lượng trên biểu đồ với đầu vào
// thật của mạng. Đặc biệt, biểu đồ FPT là giá nhưng mạng đọc log return.
const inputContent: Record<DemoDatasetId, InputDescription> = {
  shopee: {
    description:
      'Mỗi ngày, RNN nhận số lượt truy cập, thăm trang sản phẩm, giỏ hàng, thanh toán và số đơn đã ghi nhận. Biểu đồ vẽ số đơn hàng.',
    features: ['Lượt truy cập', 'Thăm sản phẩm', 'Thăm giỏ hàng', 'Thăm thanh toán', 'Đơn hàng'],
    limitation:
      'Mô phỏng Shopee Thailand, không phải dữ liệu chính thức hoặc khách Việt Nam. Lượt thăm trang giỏ không phải hành động thêm giỏ. Dự đoán số đơn có thể là số thập phân.',
  },
  fpt: {
    description:
      'Biểu đồ hiển thị giá đóng cửa bằng VND. RNN nhận mức thay đổi giá giữa hai phiên, tính bằng log(Pₜ/Pₜ₋₁).',
    features: ['1 giá trị: mức thay đổi giá theo log'],
    limitation:
      'Đầu ra được đổi từ mức thay đổi về giá VND. Nguồn FPT chỉ có Close, không cung cấp Adj Close hay phương pháp điều chỉnh.',
  },
};

export default function InputAnswer({ data }: { data: DemoDataset }) {
  const retail = data.id === 'shopee';
  const fpt = data.id === 'fpt';
  const { description, features, limitation } = inputContent[data.id];

  return (
    <>
      <h3>
        {data.title}: {data.lookback} {data.stepUnit} trước để dự đoán {fpt ? 'phiên' : 'ngày'} tiếp
        theo
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
          <strong>{fpt ? 'Phiên tới' : 'Ngày mai'}</strong>
          <span>Đổi về {data.unit}</span>
        </div>
      </div>

      <p className="quick-note">
        {retail && 'Năm loại số đếm được biến đổi bằng log(1 + x) trước khi chuẩn hóa. '}
        {limitation}
      </p>
      <p className="quick-source-note">
        Chỉ dùng lịch sử đã quan sát. Demo dùng mốc đầu tiên của tập kiểm tra, không chọn theo sai
        số.
      </p>
    </>
  );
}
