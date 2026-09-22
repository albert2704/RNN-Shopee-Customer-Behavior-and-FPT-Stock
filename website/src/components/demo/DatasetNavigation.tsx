import { Check, ChevronRight } from 'lucide-react';
import type { DemoDataset } from '../../demoTypes';
import { DATASET_COPY } from '../../domain/demo/demoCopy';
import type { PlaybackMode } from '../../domain/demo/replayTimeline';

interface Props {
  datasets: DemoDataset[];
  index: number;
  mode: PlaybackMode;
  summary: boolean;
  evaluated: boolean;
  onChoose: (index: number) => void;
  onSummary: () => void;
}

/** Chọn thủ công một tập sẽ về bước 0 và tạm dừng; hook xử lý quyết định này. */
export default function DatasetNavigation({
  datasets,
  index,
  mode,
  summary,
  evaluated,
  onChoose,
  onSummary,
}: Props) {
  return (
    <div className="stage-dataset-row">
      <nav className="stage-datasets" aria-label="Chọn dữ liệu demo">
        {datasets.map((data, i) => (
          <button key={data.id} aria-pressed={!summary && i === index} onClick={() => onChoose(i)}>
            <span className="dataset-number">
              {mode === 'all' && (i < index || (i === index && evaluated)) ? (
                <Check size={16} />
              ) : (
                i + 1
              )}
            </span>
            <span>
              <strong>{DATASET_COPY[data.id].name}</strong>
              <small>{DATASET_COPY[data.id].subject}</small>
            </span>
          </button>
        ))}
      </nav>
      <button className="stage-summary-toggle" onClick={onSummary} aria-pressed={summary}>
        Tổng kết <ChevronRight size={17} />
      </button>
    </div>
  );
}
