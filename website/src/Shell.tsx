import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Maximize2, X } from 'lucide-react';
import Explorer from './App';
import Presentation from './components/Presentation';
import DemoStage from './components/DemoStage';
import DemoSummary from './components/demo/DemoSummary';
import DemoDialog, { type DemoModal } from './components/demo/DemoDialog';
import StockChat from './components/StockChat';
import Appendix from './components/Appendix';
import { useDemoData } from './hooks/useDemoData';
import { useDemoPlayback } from './hooks/useDemoPlayback';
import {
  CHAPTERS,
  chapterFromHash,
  chapterHash,
  adjacentChapter,
  type Chapter,
} from './domain/demo/chapters';
import type { DatasetId } from './types';
import './editorial-fonts.css';
import './Editorial.css';

export default function Shell() {
  const [chapter, setChapter] = useState<Chapter>(() => chapterFromHash(location.hash));
  const [chatVisited, setChatVisited] = useState(chapter === 'chat');
  const [dataset, setDataset] = useState<DatasetId>('shopee');
  const [deep, setDeep] = useState(false);
  const deepDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (deep) deepDialog.current?.showModal();
    else deepDialog.current?.close();
  }, [deep]);
  const [modal, setModal] = useState<DemoModal>(
    ['#reference', '#learning', '#rnn-lab'].includes(location.hash) ? 'reference' : null,
  );
  const [notice, setNotice] = useState('');
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const { bundle, error } = useDemoData();
  const isDemo = chapter === 'shopee' || chapter === 'fpt';
  const playback = useDemoPlayback({
    datasets: bundle?.datasets ?? [],
    active: isDemo,
    blocked: modal !== null || deep,
    initialIndex: chapter === 'fpt' ? 1 : 0,
    onNextChapter: () => navigate(playback.index === 0 ? 'fpt' : 'summary'),
  });
  const { choose, pause } = playback;
  const navigate = useCallback(
    (next: Chapter, restore = false) => {
      pause();
      setModal(null);
      setDeep(false);
      if (next === 'shopee' || next === 'fpt')
        choose(
          next === 'fpt' ? 1 : 0,
          restore ? (bundle?.datasets[next === 'fpt' ? 1 : 0]?.lookback ?? 30) + 3 : 0,
        );
      if (next === 'chat') setChatVisited(true);
      setChapter(next);
      history.replaceState(null, '', chapterHash(next));
    },
    [choose, pause, bundle],
  );
  useEffect(() => {
    history.replaceState(null, '', chapterHash(chapterFromHash(location.hash)));
  }, []);
  useEffect(() => {
    const sync = () => {
      if (
        deep &&
        ![
          '#demo',
          '#fpt',
          '#tong-ket',
          '#du-bao',
          '#hoi-dap',
          '#phu-luc',
          '#chat',
          '#fpt-daily',
        ].includes(location.hash)
      )
        return;
      navigate(chapterFromHash(location.hash));
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [navigate, deep]);
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    document.body.classList.add('editorial-body');
    return () => document.body.classList.remove('editorial-body');
  }, []);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        isDemo ||
        modal ||
        deep ||
        event.repeat ||
        (event.target as HTMLElement).closest(
          'button,a,input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if (['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
        navigate(
          adjacentChapter(chapter, event.code === 'ArrowLeft' ? -1 : 1),
          chapter === 'summary' && event.code === 'ArrowLeft',
        );
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [chapter, isDemo, modal, deep, navigate]);
  function closeDeep() {
    setDeep(false);
    history.replaceState(null, '', chapterHash(chapter));
  }
  const current = CHAPTERS.findIndex((item) => item.id === chapter);
  const scale = viewport.width >= 900 ? Math.min(viewport.width / 1600, viewport.height / 900) : 1;
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice('Toàn màn hình chưa được hỗ trợ trong trình duyệt này.');
    }
  }
  return (
    <div className="editorial-viewport">
      <div
        className="editorial-stage"
        style={
          viewport.width >= 900
            ? { width: 1600, height: 900, transform: `scale(${scale})` }
            : undefined
        }
      >
        <header className="chapter-bar">
          <button
            className="sequence-wordmark"
            onClick={() => navigate('shopee')}
            aria-label="sequence, về đầu bài"
          >
            sequence<span>.</span>
          </button>
          <nav aria-label="Chương trình bày">
            {CHAPTERS.map((item, index) => (
              <button
                key={item.id}
                className={`${chapter === item.id ? 'current' : ''} ${index < current ? 'complete' : ''}`}
                aria-current={chapter === item.id ? 'page' : undefined}
                onClick={() => navigate(item.id)}
              >
                <span className="chapter-number">{index < current ? '✓' : `0${index + 1}`}</span>
                <span>
                  {item.label}
                  {index < 2 && (
                    <span className="chapter-ticks" aria-hidden="true">
                      {[0, 1, 2, 3].map((phase) => (
                        <i
                          key={phase}
                          className={
                            index < current
                              ? 'complete'
                              : chapter === item.id && phase <= playback.phase
                                ? 'active'
                                : ''
                          }
                        />
                      ))}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </nav>
          <div className="chapter-tools">
            <button
              className={chapter === 'appendix' ? 'current' : ''}
              onClick={() => navigate('appendix')}
              aria-current={chapter === 'appendix' ? 'page' : undefined}
            >
              Phụ lục
            </button>
            {isDemo && (
              <>
                <button
                  aria-label="Giải thích nhanh"
                  title="Giải thích nhanh"
                  onClick={() => {
                    pause();
                    setModal('quick');
                  }}
                >
                  <BookOpen size={22} />
                </button>
                <button aria-label="Toàn màn hình" onClick={() => void fullscreen()}>
                  <Maximize2 size={22} />
                </button>
              </>
            )}
          </div>
        </header>
        <div className="chapter-content">
          {isDemo && (
            <DemoStage
              playback={playback}
              error={error}
              onCalculate={() => {
                pause();
                setModal('calculation');
              }}
            />
          )}
          {chapter === 'summary' && (
            <div className="summary-chapter">
              {bundle ? (
                <DemoSummary
                  datasets={bundle.datasets}
                  onChoose={(index) => navigate(index ? 'fpt' : 'shopee')}
                  onCode={pause}
                />
              ) : (
                <p role="status">
                  {error ? 'Không tải được dữ liệu demo.' : 'Đang tải hai mô hình…'}
                  {error && <button onClick={() => location.reload()}>Thử lại</button>}
                </p>
              )}
              <ChapterFooter
                back="02 FPT"
                onBack={() => navigate('fpt', true)}
                next="04 Hỏi đáp"
                onNext={() => navigate('chat')}
              >
                Một mô hình cần được đánh giá trên nhiều mốc thời gian.
              </ChapterFooter>
            </div>
          )}
          {chatVisited && (
            <div className="chat-chapter" hidden={chapter !== 'chat'}>
              <StockChat active={chapter === 'chat'} onBack={() => navigate('shopee')} />
            </div>
          )}
          {chapter === 'appendix' && (
            <Appendix dataset={dataset} onDataset={setDataset} onDeep={() => setDeep(true)} />
          )}
        </div>
        <DemoDialog
          modal={modal}
          data={playback.data}
          read={playback.read}
          predicted={playback.predicted}
          referenceContent={<Presentation />}
          onClose={() => setModal(null)}
          onReference={() => setModal('reference')}
          onExplore={() => {
            setDataset(playback.data?.id ?? 'shopee');
            navigate('appendix');
          }}
        />
        <dialog
          ref={deepDialog}
          className="editorial-deep"
          aria-label="Phụ lục chi tiết"
          onCancel={closeDeep}
        >
          <button className="deep-close" onClick={closeDeep} autoFocus>
            <X size={20} /> Đóng phụ lục chi tiết
          </button>
          {deep && <Explorer initialDataset={dataset} />}
        </dialog>
        {notice && (
          <div className="stage-notice" role="status">
            {notice}
            <button onClick={() => setNotice('')} aria-label="Đóng thông báo">
              <X size={17} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function ChapterFooter({
  back,
  next,
  onBack,
  onNext,
  children,
}: {
  back: string;
  next: string;
  onBack: () => void;
  onNext: () => void;
  children: React.ReactNode;
}) {
  return (
    <footer className="chapter-footer">
      <button onClick={onBack}>
        <ArrowLeft size={20} />
        {back}
      </button>
      <p>{children}</p>
      <button className="editorial-primary" onClick={onNext}>
        {next}
        <ArrowRight size={20} />
      </button>
    </footer>
  );
}
