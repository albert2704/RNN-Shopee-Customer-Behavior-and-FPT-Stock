import { useEffect, useState } from 'react';
import type { Dataset } from '../types';
import { RNNIntroduction } from './SequenceFlow';
import TrainingHistory from './TrainingHistory';
import './Presentation.css';

/** Ghép demo chính với tài liệu tham khảo; dữ liệu huấn luyện ở đây chỉ là lịch sử đã lưu. */
export default function Presentation() {
  const [data, setData] = useState<Dataset | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/shopee.json', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setData)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <div className="rnn-flow stage-reference">
      <RNNIntroduction />
      {data ? (
        <TrainingHistory data={data} onFocus={() => {}} />
      ) : (
        <p>Đang tải lịch sử huấn luyện…</p>
      )}
      <div className="stage-downloads">
        <a href="/downloads/guide-trinh-bay.md" download>
          Hướng dẫn demo (.md)
        </a>
        <a href="/downloads/a6-rnn-source.zip" download>
          Mã nguồn Python &amp; website
        </a>
      </div>
    </div>
  );
}
