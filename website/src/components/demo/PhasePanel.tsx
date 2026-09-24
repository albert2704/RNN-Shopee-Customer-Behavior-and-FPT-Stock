import type { DemoDataset } from '../../demoTypes';
import type { DemoPhase } from '../../domain/demo/replayTimeline';
import { formatDate, formatNumber as n } from '../../types';
import CurrentInputs from './CurrentInputs';
import CodeLink from './CodeLink';
import {
  DATASET_COPY,
  PHASE_LABELS as phases,
  compareText,
  formatAmount as amount,
} from '../../domain/demo/demoCopy';

/** Bốn pha giữ nguyên vị trí; sai số một ví dụ và MAE toàn test không trộn với nhau. */
export default function PhasePanel({
  data,
  read,
  phase,
  onCalculate,
  onCode,
}: {
  data: DemoDataset;
  read: number;
  phase: DemoPhase;
  onCalculate: () => void;
  onCode: () => void;
}) {
  const metricDigits = data.id === 'amazon' ? 4 : 2;
  return (
    <aside className="stage-focus-panel" aria-label={phases[phase]}>
      <div key={`${data.id}-${phase}`} className="stage-focus-content">
        {phase === 0 ? (
          <>
            <h2>
              {read === 0
                ? 'RNN bắt đầu từ đâu?'
                : `Đọc ${data.stepUnit} ${read} / ${data.lookback}`}
            </h2>
            <CurrentInputs data={data} read={read} />
          </>
        ) : phase === 1 ? (
          <>
            <h2>Đọc đủ chuỗi → dự đoán</h2>
            <p className="stage-prediction-date">
              Mốc dự báo: {formatDate(data.target.timestamp, data.id !== 'amazon')}
            </p>
            <div className="stage-forecast-hero">
              <span>Dự đoán RNN</span>
              <strong>{n(data.target.prediction, 2)}</strong>
              <span>{data.unit}</span>
            </div>
            <p className="stage-focus-note">
              Đã đọc đủ {data.lookback} {data.stepUnit} quá khứ.
            </p>
            <button
              className="stage-calculation-trigger"
              onClick={onCalculate}
              aria-haspopup="dialog"
            >
              Xem cách đổi đơn vị
            </button>
          </>
        ) : phase === 2 ? (
          <>
            <h2>Đối chiếu một dự đoán</h2>
            <p className="stage-result-units">Cùng đơn vị: {data.unit}</p>
            <div className="stage-result-pair">
              <div className="stage-result-value visible">
                <span>RNN</span>
                <strong>{n(data.target.prediction, 2)}</strong>
              </div>
              <div className="stage-result-value stage-actual visible">
                <span>Thực tế</span>
                <strong>{n(data.target.value, 2)}</strong>
              </div>
              <div className="stage-result-value stage-baseline visible">
                <span>Giữ nguyên</span>
                <strong>{n(data.target.baseline, 2)}</strong>
              </div>
            </div>
            <dl className="stage-error-pair">
              <div>
                <dt>Sai số RNN</dt>
                <dd>{amount(data, data.target.absoluteError)}</dd>
              </div>
              <div>
                <dt>Sai số giữ giá trị cuối</dt>
                <dd>{amount(data, data.target.baselineAbsoluteError)}</dd>
              </div>
            </dl>
            <p className="stage-takeaway">{DATASET_COPY[data.id].caseTakeaway}</p>
          </>
        ) : (
          <>
            <h2>Trung bình dự đoán lệch bao nhiêu?</h2>
            <p className="stage-focus-note">
              Với {n(data.metrics.testCount, 0)} dự đoán trong tập kiểm tra, lấy độ lệch so với thực
              tế rồi tính trung bình (MAE). Càng nhỏ, càng gần thực tế.
            </p>
            <p className="stage-baseline-explanation">
              Cách đoán đơn giản: {DATASET_COPY[data.id].baselineExplanation.toLowerCase()}
            </p>
            <dl className="stage-test-values">
              <div>
                <dt>{DATASET_COPY[data.id].baselineLabel}</dt>
                <dd>
                  {n(data.metrics.baselineMae, metricDigits)} <small>{data.unit}</small>
                </dd>
              </div>
              <div>
                <dt>RNN</dt>
                <dd>
                  {n(data.metrics.rnnMae, metricDigits)} <small>{data.unit}</small>
                </dd>
              </div>
            </dl>
            <p className="stage-takeaway">{compareText(data)}</p>
            <p className="stage-chart-reminder">Biểu đồ bên cạnh chỉ là một ví dụ.</p>
          </>
        )}
        {phase >= 2 && (
          <div className="stage-panel-source">
            <CodeLink source="evaluation" onOpen={onCode} />
          </div>
        )}
      </div>
    </aside>
  );
}
