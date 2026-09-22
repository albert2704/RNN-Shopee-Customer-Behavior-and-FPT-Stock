import { useId, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { DemoDataset } from '../demoTypes';
import ExplanationTabs, { type ExplanationTopic } from './explanations/ExplanationTabs';
import StateAnswer from './explanations/StateAnswer';
import WeightsAnswer from './explanations/WeightsAnswer';
import TrainingAnswer from './explanations/TrainingAnswer';
import InputAnswer from './explanations/InputAnswer';
import useTrainingReplay from './explanations/useTrainingReplay';
import './QuickAnswers.css';

interface QuickAnswersProps {
  data: DemoDataset;
  read: number;
  onReference: () => void;
}

/**
 * Điều phối bốn câu trả lời ngắn trong hộp thoại.
 * DemoStage quản lý mở/đóng và tạm dừng demo chính; component này chỉ quản lý
 * chủ đề đang chọn và nhịp phát của ví dụ học một trạng thái độc lập.
 */
export default function QuickAnswers({ data, read, onReference }: QuickAnswersProps) {
  const id = useId();
  const [topic, setTopic] = useState<ExplanationTopic>('state');
  const training = useTrainingReplay(topic === 'training');

  function selectTopic(next: ExplanationTopic) {
    setTopic(next);
    // Giữ kết quả/bước đã xem, chỉ dừng đồng hồ khi người dùng đổi chủ đề.
    training.stop();
  }

  return (
    <div className="quick-answers">
      <ExplanationTabs id={id} topic={topic} onSelect={selectTopic} />

      <section
        className="quick-answer-panel"
        role="tabpanel"
        id={`${id}-answer`}
        aria-labelledby={`${id}-${topic}`}
        tabIndex={0}
      >
        {topic === 'state' && <StateAnswer data={data} read={read} />}
        {topic === 'weights' && <WeightsAnswer />}
        {topic === 'input' && <InputAnswer data={data} />}
        {topic === 'training' && (
          <TrainingAnswer
            phase={training.phase}
            running={training.running}
            onTrain={training.train}
          />
        )}
      </section>

      <footer className="quick-answer-footer">
        <button type="button" onClick={onReference}>
          Đọc giải thích đầy đủ <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}
