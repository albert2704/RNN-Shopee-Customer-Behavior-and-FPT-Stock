import type { KeyboardEvent } from 'react';

export type ExplanationTopic = 'state' | 'weights' | 'training' | 'input';

const topics: { id: ExplanationTopic; label: string }[] = [
  { id: 'state', label: 'Trạng thái' },
  { id: 'weights', label: 'Trọng số' },
  { id: 'training', label: 'Huấn luyện' },
  { id: 'input', label: 'Đầu vào' },
];

interface ExplanationTabsProps {
  id: string;
  topic: ExplanationTopic;
  onSelect: (topic: ExplanationTopic) => void;
}

/** Chỉ điều khiển chọn chủ đề; không đọc dữ liệu hay tính toán mô hình. */
export default function ExplanationTabs({ id, topic, onSelect }: ExplanationTabsProps) {
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;

    // Một tab nhận focus tại một thời điểm. Phím mũi tên chọn tab liền kề;
    // Home/End chọn đầu/cuối, giữ cùng hành vi với thao tác chuột.
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % topics.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index + topics.length - 1) % topics.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = topics.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    onSelect(topics[nextIndex].id);
    document.getElementById(`${id}-${topics[nextIndex].id}`)?.focus();
  }

  return (
    <div className="quick-topics" role="tablist" aria-label="Chủ đề giải thích nhanh">
      {topics.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`${id}-${item.id}`}
          aria-controls={`${id}-answer`}
          aria-selected={topic === item.id}
          tabIndex={topic === item.id ? 0 : -1}
          onClick={() => onSelect(item.id)}
          onKeyDown={(event) => moveFocus(event, index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
