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
    id: 'shopee',
    name: 'Shopee Thailand',
    label: 'Bài A6 · Hành vi mô phỏng',
    Icon: ShoppingBag,
    observation: 'Một ngày: số lượt truy cập, thăm sản phẩm, giỏ hàng, thanh toán và đơn hàng.',
    input: '30 ngày trước, mỗi ngày có 5 số đếm qua log1p.',
    prediction: 'Số đơn hàng trong ngày tiếp theo.',
    rnnMAE: '309,75',
    baselineMAE: '141,56',
    unit: 'đơn hàng / ngày',
    finding:
      'RNN và GRU có MAE cao hơn cách đoán như hôm trước. Dữ liệu mô phỏng, không chứng minh hiệu quả trên Shopee thực tế.',
    details: [
      {
        label: 'Chuẩn bị',
        text: '500.000 lượt truy cập, 2.696.481 lượt thăm trang và 300.000 đơn hàng. Tổng hợp 1.461 ngày trong 2022–2025. Bỏ lượt thăm bắt đầu ở ngày 01/01/2026 ngoài khoảng mục tiêu.',
      },
      {
        label: 'Đầu vào của một mẫu',
        text: '30 × 5: lượt truy cập, thăm sản phẩm, giỏ hàng, thanh toán và số đơn quá khứ. Dùng log1p rồi chuẩn hóa chỉ theo train.',
      },
      {
        label: 'Đánh giá',
        text: '216 ngày kiểm tra. RNN: MAE 309,75; RMSE 589,76. GRU: MAE 299,74; đoán như hôm trước: MAE 141,56 đơn. Mỗi dự đoán dùng lịch sử trước ngày đích.',
      },
    ],
  },
  {
    id: 'fpt',
    name: 'FPT',
    label: 'Bài A6 · Chứng khoán',
    Icon: TrendingUp,
    observation: 'Một phiên giao dịch: mức thay đổi giá đóng cửa so với phiên trước.',
    input: '30 phiên trước, biểu diễn bằng lợi suất log.',
    prediction: 'Lợi suất phiên tiếp theo, rồi đổi thành giá đóng cửa.',
    rnnMAE: '1.059,92',
    baselineMAE: '1.053,73',
    unit: 'VND / cổ phiếu',
    finding: 'RNN và GRU đều có MAE và RMSE cao hơn cách giữ giá phiên trước trong lần thử này.',
    details: [
      {
        label: 'Lợi suất log là gì?',
        text: 'rₜ = ln(Pₜ / Pₜ₋₁), với P là giá đóng cửa. Giá dự báo = giá phiên trước × exp(lợi suất dự báo).',
      },
      {
        label: 'Đầu vào của một mẫu',
        text: '30 × 1. Từ 2.706 dòng, loại 87 dòng trùng hoàn toàn và 1 dòng trùng ngày/OHLCV; còn 2.618 phiên và 2.617 lợi suất. Không thêm ngày nghỉ.',
      },
      {
        label: 'Đánh giá',
        text: '389 phiên kiểm tra. RNN: MAE 1.059,92; GRU: MAE 1.058,94; giữ giá trước: MAE 1.053,73 VND. Sai số được tính trên giá, không phải lợi suất.',
      },
      {
        label: 'Giới hạn',
        text: 'Kaggle cung cấp Close từ 02/01/2013 đến 30/06/2023, không có Adj Close hay phương pháp điều chỉnh. Kết quả không chứng minh khả năng sinh lời.',
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
          <p>Shopee Thailand và FPT là hai tập dữ liệu của A6.</p>
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
