import type { DemoDataset } from '../../demoTypes';
import { getInputReadout } from '../../domain/demo/inputReadout';

/** Hiện các phép đo dễ đọc; năm số đếm hành vi được giữ đúng nghĩa nguồn. */
export default function CurrentInputs({ data, read }: { data: DemoDataset; read: number }) {
  const input = getInputReadout(data, read);
  const when = input.timestamp || (data.id === 'fpt' ? 'mỗi phiên' : 'mỗi ngày');
  return (
    <section className={`stage-current-inputs ${data.id}`} aria-label="Đầu vào RNN">
      <header className="stage-current-inputs-head">
        <h3>Đầu vào · {when}</h3>
        <small>{input.featureCount} giá trị</small>
      </header>
      <dl className="stage-current-input-values">
        {input.items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>
              {item.value === null ? (
                <span aria-label="Chưa đọc">—</span>
              ) : (
                new Intl.NumberFormat('vi-VN', {
                  minimumFractionDigits: item.digits,
                  maximumFractionDigits: item.digits,
                }).format(item.value)
              )}
              {item.unit && <small> {item.unit}</small>}
            </dd>
          </div>
        ))}
      </dl>
      <footer className="stage-current-inputs-note">
        <p>{input.extra}</p>
        <p>{input.preprocessing}</p>
      </footer>
    </section>
  );
}
