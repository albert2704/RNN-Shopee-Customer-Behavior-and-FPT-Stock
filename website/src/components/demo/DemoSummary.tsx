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
        <span className="editorial-eyebrow">03 — TỔNG KẾT · TOÀN TẬP KIỂM TRA</span>
        <h1 id="summary-title">Cùng là RNN, hiệu quả khác nhau.</h1>
        <p>
          Mỗi dự đoán lệch thực tế bao nhiêu? Các số dưới đây là độ lệch trung bình (MAE), càng nhỏ
          càng tốt.
        </p>
      </div>
      <div className="stage-summary-cards">
        {datasets.map((data, index) => (
          <article key={data.id}>
            <h2>{DATASET_COPY[data.id].name}</h2>
            <span>
              {formatNumber(data.metrics.testCount, 0)} dự đoán · {data.unit}
            </span>
            <dl>
              <div>
                <dt>{DATASET_COPY[data.id].baselineLabel}</dt>
                <dd>{formatNumber(data.metrics.baselineMae, 2)}</dd>
                <div className="editorial-bar">
                  <i
                    style={{
                      width: `${(data.metrics.baselineMae / Math.max(data.metrics.baselineMae, data.metrics.rnnMae, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <dt>RNN</dt>
                <dd>
                  {formatNumber(data.metrics.rnnMae, 2)} <small>{data.unit}</small>
                </dd>
                <div className="editorial-bar">
                  <i
                    style={{
                      width: `${(data.metrics.rnnMae / Math.max(data.metrics.baselineMae, data.metrics.rnnMae, 1)) * 100}%`,
                    }}
                  />
                </div>
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
