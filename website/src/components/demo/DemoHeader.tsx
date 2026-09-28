import { BookOpen, Database, Layers3, Maximize2, TrendingUp, MessageSquare } from 'lucide-react';

interface Props {
  ready: boolean;
  onHome: () => void;
  onQuickAnswers: () => void;
  onDetails: () => void;
  onFullscreen: () => void;
  onDaily: () => void;
}

/** Thanh công cụ phụ; nội dung chính vẫn chạy trong cùng một màn hình. */
export default function DemoHeader({
  ready,
  onHome,
  onQuickAnswers,
  onDetails,
  onFullscreen,
  onDaily,
}: Props) {
  return (
    <header className="stage-header">
      <a href="#demo" className="stage-brand" onClick={onHome}>
        <Layers3 size={24} />
        <span>sequence.</span>
      </a>
      <div>
        <button
          aria-label="Chat đầu tư"
          onClick={() => {
            location.hash = '#chat';
          }}
        >
          <MessageSquare size={18} />
          <span>Chat đầu tư</span>
        </button>
        <button aria-label="Dự báo FPT" onClick={onDaily}>
          <TrendingUp size={18} />
          <span>Dự báo FPT</span>
        </button>
        <button aria-label="Giải thích nhanh" onClick={onQuickAnswers} disabled={!ready}>
          <BookOpen size={18} />
          <span>Giải thích nhanh</span>
        </button>
        <button aria-label="Dữ liệu & phép tính" onClick={onDetails} disabled={!ready}>
          <Database size={18} />
          <span>Dữ liệu & phép tính</span>
        </button>
        <button onClick={onFullscreen} aria-label="Toàn màn hình">
          <Maximize2 size={20} />
        </button>
      </div>
    </header>
  );
}
