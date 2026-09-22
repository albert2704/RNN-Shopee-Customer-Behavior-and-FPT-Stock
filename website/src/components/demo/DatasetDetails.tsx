import { ArrowRight } from 'lucide-react';
import type { DemoDataset } from '../../demoTypes';
import { formatDate, formatNumber as n } from '../../types';

/** Phụ lục mở tại đúng bước đang xem để đối chiếu vector x_t, h_t và phép biến đổi. */
export default function DatasetDetails({
  data,
  read,
  onExplore,
}: {
  data: DemoDataset;
  read: number;
  onExplore: () => void;
}) {
  const point = read ? data.context[read - 1] : null;
  return (
    <div className="stage-details">
      <p>{data.notes.selection}</p>
      <h3>Đầu vào và đầu ra</h3>
      <p>{data.notes.input}</p>
      <p>{data.notes.output}</p>
      <p>{data.notes.display}</p>
      <dl>
        <div>
          <dt>Cửa sổ</dt>
          <dd>
            {data.lookback} {data.stepUnit} × {data.inputSize} đặc trưng
          </dd>
        </div>
        <div>
          <dt>Đặc trưng</dt>
          <dd>{data.featureNames.join(', ')}</dd>
        </div>
        <div>
          <dt>Mốc dự đoán</dt>
          <dd>{formatDate(data.target.timestamp, data.id !== 'amazon')}</dd>
        </div>
      </dl>
      <h3>Phép tính ở bước {read}</h3>
      <p className="stage-equation">hₜ = tanh(Wₓxₜ + bₓ + Wₕhₜ₋₁ + bₕ)</p>
      <p>
        Trạng thái bắt đầu bằng 32 số 0 ở mỗi cửa sổ. Mạng dùng các trọng số đã học; hoạt ảnh phát
        lại phép tính từ checkpoint, không huấn luyện lại.
      </p>
      <dl>
        <div>
          <dt>xₜ đã chuẩn hóa</dt>
          <dd>
            {point
              ? `[${point.normalizedInput.map((v) => n(v, 4)).join('; ')}]`
              : 'Chưa đọc bước nào.'}
          </dd>
        </div>
        <div>
          <dt>hₜ · 32 giá trị</dt>
          <dd>{point ? `[${point.hiddenState.map((v) => n(v, 4)).join('; ')}]` : '[0; …; 0]'}</dd>
        </div>
      </dl>
      <h3>Đánh giá toàn tập kiểm tra</h3>
      <p>
        Chia theo thời gian 70% học, 15% chọn mô hình, 15% kiểm tra. Chỉ chuẩn hóa bằng tập học. Mỗi
        dự đoán dùng lịch sử đã quan sát đứng trước nó.
      </p>
      <table>
        <caption>
          {n(data.metrics.testCount, 0)} mục tiêu · cùng đơn vị {data.unit}
        </caption>
        <thead>
          <tr>
            <th>Mô hình</th>
            <th>MAE</th>
            <th>RMSE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Giữ nguyên giá trị trước</th>
            <td>{n(data.metrics.baselineMae, 4)}</td>
            <td>{n(data.metrics.baselineRmse, 4)}</td>
          </tr>
          <tr>
            <th>RNN</th>
            <td>{n(data.metrics.rnnMae, 4)}</td>
            <td>{n(data.metrics.rnnRmse, 4)}</td>
          </tr>
        </tbody>
      </table>
      <p>{data.notes.limitation}</p>
      <p>{data.source.clockNote}</p>
      <div className="stage-detail-actions">
        <a href={data.source.url} target="_blank" rel="noreferrer">
          Nguồn dữ liệu ↗
        </a>
        <button onClick={onExplore}>
          Mở phân tích đầy đủ <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
