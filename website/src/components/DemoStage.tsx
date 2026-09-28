import { getAnnouncement, getCaption } from '../domain/demo/demoCopy';
import type { DemoPlayback } from '../hooks/useDemoPlayback';
import DemoHeading from './demo/DemoHeading';
import ReplayChart from './demo/ReplayChart';
import RecurrentMechanism from './demo/RecurrentMechanism';
import PhasePanel from './demo/PhasePanel';
import PlaybackControls from './demo/PlaybackControls';
import './DemoStage.css';
import './demo/StateHandover.css';
import './demo/MechanismClarity.css';

export default function DemoStage({
  playback,
  error,
  onCalculate,
}: {
  playback: DemoPlayback;
  error: boolean;
  onCalculate: () => void;
}) {
  const { data, read, phase, predicted, revealed } = playback;
  if (!data)
    return (
      <main className="stage-loading" role="status">
        <p>{error ? 'Không tải được dữ liệu demo.' : 'Đang tải hai mô hình…'}</p>
        {error && <button onClick={() => location.reload()}>Thử lại</button>}
      </main>
    );
  const caption = getCaption(playback);
  return (
    <main id="demo" className="stage-main">
      <DemoHeading data={data} phase={phase} />
      <section className="stage-workspace" aria-label={`Hoạt ảnh ${data.title}`}>
        <div className="stage-observation">
          <ReplayChart data={data} read={read} predicted={predicted} revealed={revealed} />
          <PhasePanel
            data={data}
            read={read}
            phase={phase}
            onCalculate={onCalculate}
            onCode={playback.pause}
          />
        </div>
        <RecurrentMechanism
          data={data}
          read={read}
          predicted={predicted}
          progress={playback.progress}
          snapshot={playback.snapshot}
          evaluated={playback.evaluated}
          onCalculate={onCalculate}
          onCode={playback.pause}
        />
      </section>
      <PlaybackControls
        data={data}
        playback={playback}
        caption={caption}
        announcement={getAnnouncement(data, phase, false, caption)}
      />
    </main>
  );
}
