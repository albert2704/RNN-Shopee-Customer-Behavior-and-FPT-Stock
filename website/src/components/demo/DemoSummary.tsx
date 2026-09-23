import { ArrowRight } from 'lucide-react';
import type { DemoDataset } from '../../demoTypes';
import { formatNumber } from '../../types';
import { compareText, DATASET_COPY } from '../../domain/demo/demoCopy';
import CodeLink from './CodeLink';

/** MAE của toàn tập kiểm tra, không phải sai số của riêng ví dụ đang phát. */
export default function DemoSummary({
  datasets,
  onChoose,
  onCode,
}: {
  datasets: DemoDataset[];
  onChoose: (index: number) => void;
  onCode: () => void;
}) {
  return (
    <section className="stage-summary" aria-labelledby="summary-title">
      <div>
        <h1 id="summary-title">Cùng là RNN, hiệu quả khác nhau.</h1>
        <p>MAE trên toàn tập kiểm tra: sai số tuyệt đối trung bình, càng thấp càng tốt.</p>
      </div>
      <div className="stage-summary-cards">
        {datasets.map((data, index) => (
          <article key={data.id}>
            <h2>{DATASET_COPY[data.id].name}</h2>
            <span>{formatNumber(data.metrics.testCount, 0)} dự đoán</span>
            <dl>
              <div>
                <dt>Giữ nguyên</dt>
                <dd>{formatNumber(data.metrics.baselineMae, data.id === 'amazon' ? 4 : 2)}</dd>
              </div>
              <div>
                <dt>RNN</dt>
                <dd>
                  {formatNumber(data.metrics.rnnMae, data.id === 'amazon' ? 4 : 2)}{' '}
                  <small>{data.unit}</small>
                </dd>
              </div>
            </dl>
            <p>{compareText(data)}</p>
            <button onClick={() => onChoose(index)}>
              Xem lại demo <ArrowRight size={17} />
            </button>
          </article>
        ))}
      </div>
      <p className="stage-summary-conclusion">
        Một dự đoán đúng chưa chứng minh mô hình tốt. Cần kiểm tra trên nhiều mốc thời gian và so
        với cách dự đoán đơn giản.
      </p>
      <p className="stage-summary-limit">
        Kết quả của một lần huấn luyện. Không so trực tiếp MAE giữa các tập có đơn vị khác nhau.
      </p>
      <div className="stage-mechanism-actions">
        <CodeLink source="evaluation" onOpen={onCode} />
        <CodeLink source="training" onOpen={onCode} />
      </div>
    </section>
  );
}
