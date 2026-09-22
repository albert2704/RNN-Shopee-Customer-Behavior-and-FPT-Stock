import { useEffect, useState } from 'react';
import type { Dataset, DatasetId } from '../types';
import { RNNIntroduction } from './SequenceFlow';
import TrainingHistory from './TrainingHistory';
import DemoStage from './DemoStage';
import './Presentation.css';

/** Ghép demo chính với tài liệu tham khảo; dữ liệu huấn luyện ở đây chỉ là lịch sử đã lưu. */
export default function Presentation({
  onExplore,
  active = true,
}: {
  onExplore: (anchor?: string, dataset?: DatasetId) => void;
  active?: boolean;
}) {
  const [data, setData] = useState<Dataset | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/data/retailrocket.json')
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <DemoStage
      active={active}
      onExplore={onExplore}
      referenceContent={
        <div className="rnn-flow stage-reference">
          <RNNIntroduction />
          {data ? (
            <TrainingHistory data={data} onFocus={() => {}} />
          ) : (
            <p>Chưa tải được lịch sử huấn luyện. Đóng và mở lại trang để thử lại.</p>
          )}
          <div className="stage-downloads">
            <a href="/downloads/guide-trinh-bay.md" download>
              Hướng dẫn demo (.md)
            </a>
            <a href="/downloads/demo-briefing-vi.md" download>
              Giải thích mô hình &amp; mã nguồn (.md)
            </a>
          </div>
        </div>
      }
    />
  );
}
