import { Check } from 'lucide-react';
import type { DemoDataset } from '../../demoTypes';
import { DATASET_COPY, PHASE_LABELS } from '../../domain/demo/demoCopy';
import type { DemoPhase } from '../../domain/demo/replayTimeline';

/** Câu hỏi dự báo và tiến độ bốn pha, lấy nội dung từ một nơi duy nhất. */
export default function DemoHeading({ data, phase }: { data: DemoDataset; phase: DemoPhase }) {
  const copy = DATASET_COPY[data.id];
  return (
    <div className="stage-heading">
      <h1>{copy.question}</h1>
      <ol className="stage-phases" aria-label="Giai đoạn demo">
        {PHASE_LABELS.map((label, i) => (
          <li
            key={label}
            className={phase === i ? 'current' : phase > i ? 'complete' : ''}
            aria-current={phase === i ? 'step' : undefined}
          >
            <span>{phase > i ? <Check size={13} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <p>{copy.inputDescription}</p>
    </div>
  );
}
