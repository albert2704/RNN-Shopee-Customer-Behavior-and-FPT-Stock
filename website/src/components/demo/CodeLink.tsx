import { ExternalLink } from 'lucide-react';

const sources = {
  data: ['Code dữ liệu', 'models/src/preprocessing.py#L171'],
  model: ['Code mô hình', 'models/src/models.py#L6'],
  training: ['Code huấn luyện', 'models/src/training.py#L31'],
  evaluation: ['Code đánh giá', 'models/src/evaluation.py#L23'],
  replay: ['Code phát lại', 'website/scripts/export_demo.py#L104'],
} as const;

/** Các liên kết trỏ thẳng đến mã hiện có, không tạo ví dụ Python khác. */
export default function CodeLink({
  source,
  onOpen,
}: {
  source: keyof typeof sources;
  onOpen?: () => void;
}) {
  const [label, path] = sources[source];
  return (
    <a
      className="stage-code-link"
      href={`https://github.com/albert2704/RNN-Retailrocket-and-Amazon-Stock/blob/main/${path}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      aria-label={`${label} (GitHub, mở tab mới)`}
    >
      {label} <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}
