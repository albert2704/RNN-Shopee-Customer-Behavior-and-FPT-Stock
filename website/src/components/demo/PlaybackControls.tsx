import { Pause, Play, RotateCcw } from 'lucide-react';
import type { DemoDataset } from '../../demoTypes';
import { DATASET_COPY } from '../../domain/demo/demoCopy';
import type { DemoPlayback } from '../../hooks/useDemoPlayback';

interface Props {
  data: DemoDataset;
  playback: DemoPlayback;
  caption: string;
  announcement: string;
}

/** Nút và thanh tua chỉ gọi bộ điều khiển; không can thiệp vào số liệu mô hình. */
export default function PlaybackControls({ data, playback, caption, announcement }: Props) {
  const { playing, begun, summary, playLabel, read, length, frame, speed, mode } = playback;
  return (
    <footer className="stage-player">
      {/* Thông báo kết quả theo pha cho người dùng trình đọc màn hình. */}
      <p className="sr-only" role="status" aria-atomic="true">
        {announcement}
      </p>
      {!summary && (
        <div className="stage-caption">
          <span className={playing ? 'stage-live-dot active' : 'stage-live-dot'} />
          <p>{caption}</p>
        </div>
      )}
      <div className="stage-controls">
        <button className="stage-primary" onClick={playback.toggle} aria-label={playLabel}>
          {playing ? <Pause size={19} /> : <Play size={19} />}
          <span>{playLabel}</span>
        </button>
        {begun && !summary && (
          <button
            className="stage-restart"
            title={`Chạy lại cả ${playback.datasetCount} từ đầu`}
            aria-label={`Chạy lại cả ${playback.datasetCount} từ đầu`}
            onClick={playback.startAll}
          >
            <RotateCcw size={18} />
          </button>
        )}
        {!summary && (
          <label className="stage-progress">
            <span>
              {DATASET_COPY[data.id].name}{' '}
              <b>
                {read}/{length} {data.stepUnit}
              </b>
            </span>
            <input
              aria-label="Tiến trình demo"
              type="range"
              min="0"
              max={playback.lastFrame}
              value={frame}
              onChange={(event) => playback.seek(Number(event.target.value))}
            />
          </label>
        )}
        <label className="stage-speed">
          <span>Tốc độ</span>
          <select
            aria-label="Tốc độ phát"
            value={speed}
            onChange={(event) => playback.setSpeed(Number(event.target.value))}
          >
            <option value={0.5}>0,5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </label>
        <span className="stage-key-hint">
          <kbd>Space</kbd> phát / dừng
        </span>
      </div>
      <p className="stage-provenance">
        Phát lại mô hình đã huấn luyện · mẫu đầu tiên của tập kiểm tra ·{' '}
        {mode === 'all' ? `tự chuyển cả ${playback.datasetCount} tập` : 'đang xem một tập'}
      </p>
    </footer>
  );
}
