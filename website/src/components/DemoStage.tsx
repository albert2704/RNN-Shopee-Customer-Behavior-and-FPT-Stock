import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { DatasetId } from '../types';
import { DATASET_COPY, getAnnouncement, getCaption } from '../domain/demo/demoCopy';
import { useDemoData } from '../hooks/useDemoData';
import { useDemoPlayback } from '../hooks/useDemoPlayback';
import DemoHeader from './demo/DemoHeader';
import DatasetNavigation from './demo/DatasetNavigation';
import DemoHeading from './demo/DemoHeading';
import ReplayChart from './demo/ReplayChart';
import RecurrentMechanism from './demo/RecurrentMechanism';
import PhasePanel from './demo/PhasePanel';
import DemoSummary from './demo/DemoSummary';
import PlaybackControls from './demo/PlaybackControls';
import DemoDialog, { type DemoModal } from './demo/DemoDialog';
import './DemoStage.css';
import './demo/StateHandover.css';
import './demo/MechanismClarity.css';

interface Props {
  referenceContent: ReactNode;
  onExplore: (anchor?: string, dataset?: DatasetId) => void;
  active: boolean;
}

/**
 * Điểm ghép màn hình demo. Đọc file này để hiểu các phần nối với nhau ra sao.
 * - useDemoData: lấy phép tính thật đã xuất từ PyTorch.
 * - useDemoPlayback: chọn dataset, bước đọc và pha hiển thị.
 * - Các component demo/: chỉ vẽ dữ liệu và gọi thao tác người dùng.
 * Huấn luyện nằm ở models/src/, KHÔNG nằm trong component React này.
 */
export default function DemoStage({ referenceContent, onExplore, active }: Props) {
  const { bundle, error } = useDemoData();
  const [modal, setModal] = useState<DemoModal>(
    ['#reference', '#learning', '#rnn-lab'].includes(location.hash) ? 'reference' : null,
  );
  const [notice, setNotice] = useState('');
  const playback = useDemoPlayback({
    datasets: bundle?.datasets ?? [],
    active,
    blocked: modal !== null,
  });
  const { data, index, read, phase, predicted, revealed, summary } = playback;
  const nextDataset = bundle?.datasets[index + 1];
  const caption = getCaption(playback, nextDataset ? DATASET_COPY[nextDataset.id].name : undefined);

  function closeModal() {
    setModal(null);
    history.replaceState(null, '', '#demo');
  }

  function explore() {
    playback.pause();
    closeModal();
    onExplore('datasets', data?.id);
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice('Toàn màn hình chưa được hỗ trợ trong trình duyệt này.');
    }
  }

  return (
    <div className="demo-stage-shell">
      <DemoHeader
        ready={!!data}
        onHome={playback.returnToDemo}
        onQuickAnswers={() => setModal('quick')}
        onDetails={() => setModal('details')}
        onFullscreen={fullscreen}
      />
      {!data || !bundle ? (
        <main className="stage-loading" role="status">
          <p>{error ? 'Không tải được dữ liệu demo.' : 'Đang tải hai mô hình…'}</p>
          {error && <button onClick={() => location.reload()}>Thử lại</button>}
        </main>
      ) : (
        <main id="demo" className="stage-main">
          <DatasetNavigation
            datasets={bundle.datasets}
            index={index}
            mode={playback.mode}
            summary={summary}
            evaluated={playback.evaluated}
            onChoose={playback.choose}
            onSummary={playback.toggleSummary}
          />
          {summary ? (
            <DemoSummary
              datasets={bundle.datasets}
              onChoose={playback.choose}
              onCode={playback.pause}
            />
          ) : (
            <>
              <DemoHeading data={data} phase={phase} />
              <section className="stage-workspace" aria-label={`Hoạt ảnh ${data.title}`}>
                <div className="stage-observation">
                  <ReplayChart data={data} read={read} predicted={predicted} revealed={revealed} />
                  <PhasePanel
                    data={data}
                    read={read}
                    phase={phase}
                    onCalculate={() => setModal('calculation')}
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
                  onCalculate={() => setModal('calculation')}
                  onCode={playback.pause}
                />
              </section>
            </>
          )}
          <PlaybackControls
            data={data}
            playback={playback}
            caption={caption}
            announcement={getAnnouncement(data, phase, summary, caption)}
          />
        </main>
      )}
      <DemoDialog
        modal={modal}
        data={data}
        read={read}
        predicted={predicted}
        referenceContent={referenceContent}
        onClose={closeModal}
        onReference={() => setModal('reference')}
        onExplore={explore}
      />
      {notice && (
        <div role="status" className="stage-notice">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Đóng thông báo">
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
