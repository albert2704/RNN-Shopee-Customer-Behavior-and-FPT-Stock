import { ArrowRight, ChevronDown, Download, ShoppingBag, TrendingUp } from 'lucide-react';
import type { DatasetId } from '../types';
import './DatasetOverview.css';

type DatasetSummary = {
  id: DatasetId;
  name: string;
  label: string;
  Icon: typeof ShoppingBag;
  observation: string;
  input: string;
  prediction: string;
  rnnMAE: string;
  baselineMAE: string;
  unit: string;
  finding: string;
  details: { label: string; text: string }[];
};

// Values are rounded from the saved test metrics in public/data/<id>.json.
const datasets: DatasetSummary[] = [
  {
    id: 'retailrocket',
    name: 'Retailrocket',
    label: 'Bài A6 · Hành vi khách hàng',
    Icon: ShoppingBag,
    observation: 'Một giờ: số lượt xem, thêm giỏ và sự kiện giao dịch được ghi nhận.',
    input: '24 giờ trước, kèm thông tin giờ và thứ trong tuần.',
    prediction: 'Số sự kiện giao dịch trong giờ tiếp theo.',
    rnnMAE: '2,512',
    baselineMAE: '3,458',
    unit: 'sự kiện / giờ',
    finding:
      'RNN có sai số thấp hơn. Đây là số sự kiện tổng hợp, không phải số đơn hàng hay dự đoán cho từng người.',
    details: [
      {
        label: 'Chuẩn bị',
        text: 'Từ 2.756.101 sự kiện gốc, loại 460 dòng trùng hoàn toàn và hai ngày UTC ở biên chưa đủ 24 giờ; còn 3.288 giờ.',
      },
      {
        label: 'Đầu vào của một mẫu',
        text: '24 × 7: ba số đếm sự kiện và bốn giá trị sin/cos biểu diễn giờ, thứ. Số đếm được biến đổi bằng log1p trước khi chuẩn hóa.',
      },
      {
        label: 'Đánh giá',
        text: '491 giờ kiểm tra. RNN: MAE 2,512; RMSE 3,646. GRU: MAE 2,545. Dự báo được đổi về đơn vị số sự kiện trước khi tính các chỉ số này.',
      },
    ],
  },
  {
    id: 'amazon',
    name: 'Amazon',
    label: 'Bài A6 · Chứng khoán',
    Icon: TrendingUp,
    observation: 'Một phiên giao dịch: mức thay đổi giá đóng cửa điều chỉnh so với phiên trước.',
    input: '30 phiên trước, biểu diễn bằng lợi suất log.',
    prediction: 'Lợi suất phiên tiếp theo, rồi đổi thành giá đóng cửa điều chỉnh.',
    rnnMAE: '2,269',
    baselineMAE: '2,262',
    unit: 'USD / cổ phiếu điều chỉnh',
    finding:
      'RNN chưa tốt hơn cách giữ nguyên giá. GRU giảm MAE rất ít nhưng có RMSE cao hơn: chưa có lợi thế nhất quán.',
    details: [
      {
        label: 'Lợi suất log là gì?',
        text: 'rₜ = ln(Pₜ / Pₜ₋₁), với P là giá đóng cửa điều chỉnh. Giá dự báo = giá phiên trước × exp(lợi suất dự báo).',
      },
      {
        label: 'Đầu vào của một mẫu',
        text: '30 × 1. Từ 6.684 phiên gốc còn 6.683 lợi suất; không tạo thêm dữ liệu cho cuối tuần và ngày nghỉ.',
      },
      {
        label: 'Đánh giá',
        text: '999 phiên kiểm tra. GRU: MAE 2,2614, RMSE 3,1064; giữ nguyên giá: MAE 2,2623, RMSE 3,1048. Sai số được tính trên giá, không phải lợi suất.',
      },
      {
        label: 'Giới hạn',
        text: 'Nguồn dùng giá điều chỉnh hồi cứu và kết thúc ngày 05/12/2023. Kết quả này không chứng minh khả năng sinh lời khi giao dịch.',
      },
    ],
  },
];

export default function DatasetOverview({
  onExplore,
}: {
  onExplore: (anchor?: string, dataset?: DatasetId) => void;
}) {
  return (
    <section
      id="datasets-links"
      data-flow-topic
      className="flow-section datasets-section dataset-lessons"
    >
      <div className="flow-section-heading">
        <div>
          <h2>Cùng một cách làm, hai bài toán</h2>
          <p>Retailrocket và Amazon là hai tập dữ liệu của A6.</p>
        </div>
      </div>
      <p className="dataset-comparison-intro">
        <strong>So với cách đơn giản nhất:</strong> dự báo giá trị tiếp theo bằng giá trị vừa quan
        sát. MAE là sai số tuyệt đối trung bình; càng thấp càng tốt.
      </p>
      <div className="flow-datasets dataset-summary-grid">
        {datasets.map(
          ({
            id,
            name,
            label,
            Icon,
            observation,
            input,
            prediction,
            rnnMAE,
            baselineMAE,
            unit,
            finding,
            details,
          }) => (
            <article className="dataset-summary" key={id} aria-labelledby={`summary-${id}`}>
              <header className="dataset-summary-heading">
                <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <p>{label}</p>
                  <h3 id={`summary-${id}`}>{name}</h3>
                </div>
              </header>
              <dl className="dataset-summary-questions">
                <div>
                  <dt>Một quan sát</dt>
                  <dd>{observation}</dd>
                </div>
                <div>
                  <dt>Đầu vào</dt>
                  <dd>{input}</dd>
                </div>
                <div>
                  <dt>Dự đoán</dt>
                  <dd>{prediction}</dd>
                </div>
              </dl>
              <div className="dataset-summary-result">
                <h4>Kết quả</h4>
                <p className="dataset-summary-metric-label">MAE trên tập kiểm tra · {unit}</p>
                <dl className="dataset-summary-metrics">
                  <div>
                    <dt>RNN</dt>
                    <dd>{rnnMAE}</dd>
                  </div>
                  <div>
                    <dt>Giữ nguyên giá trị trước</dt>
                    <dd>{baselineMAE}</dd>
                  </div>
                </dl>
                <p className="dataset-summary-finding">{finding}</p>
              </div>
              <details className="dataset-summary-details">
                <summary>
                  Chi tiết thí nghiệm <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <dl>
                  {details.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.text}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              <button
                className="dataset-summary-open"
                onClick={() => onExplore('datasets', id)}
                aria-label={`Xem dữ liệu ${name}`}
              >
                Xem dữ liệu và dự báo <ArrowRight size={17} aria-hidden="true" />
              </button>
            </article>
          ),
        )}
      </div>
      <p className="dataset-comparison-note">
        Mỗi kết quả đến từ một lần huấn luyện và một cách chia dữ liệu theo thời gian. Chuẩn hóa chỉ
        dùng tập huấn luyện. So sánh các mô hình trong cùng một tập dữ liệu vì hai tập có đơn vị
        khác nhau.
      </p>
      <div className="flow-resources">
        <button onClick={() => onExplore('rnn-lab')}>
          Công thức &amp; mã PyTorch <ArrowRight size={16} />
        </button>
        <a href="/downloads/a6-rnn-source.zip" download>
          <Download size={16} />
          Mã thí nghiệm
        </a>
      </div>
    </section>
  );
}
