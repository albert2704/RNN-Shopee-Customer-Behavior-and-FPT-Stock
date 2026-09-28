import { ArrowRight, Pause, Play, RotateCcw } from 'lucide-react';
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
  const { playing, summary, playLabel, read, length, frame, speed } = playback;
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
          {playing ? (
            <Pause size={19} />
          ) : playback.predicted && !playback.evaluated ? (
            <ArrowRight size={19} />
          ) : (
            <Play size={19} />
          )}
          <span>{playLabel}</span>
        </button>
        {!summary && (
          <button
            className="stage-restart"
            title="Chạy lại tập này từ đầu"
            aria-label="Chạy lại tập này từ đầu"
            onClick={playback.restartCurrent}
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
              max={length + 1}
              value={Math.min(frame, length + 1)}
              onChange={(event) => playback.seek(Number(event.target.value))}
            />
          </label>
        )}
        <div className="stage-speed" role="group" aria-label="Tốc độ phát">
          {[0.5, 1, 2].map((value) => (
            <button
              key={value}
              aria-pressed={speed === value}
              onClick={() => playback.setSpeed(value)}
            >
              {value === 0.5 ? '0,5' : value}×
            </button>
          ))}
        </div>
        <span className="stage-key-hint">
          <kbd>Space</kbd> {playback.predicted ? 'bước tiếp' : 'phát / dừng'}
        </span>
      </div>
      <p className="stage-provenance">
        Phát lại mô hình đã huấn luyện · mẫu đầu tiên của tập kiểm tra · chạy riêng từng tập
      </p>
    </footer>
  );
}
