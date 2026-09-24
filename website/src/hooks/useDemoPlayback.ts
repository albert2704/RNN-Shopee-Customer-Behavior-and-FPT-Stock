import { useCallback, useEffect, useState } from 'react';
import type { DemoDataset } from '../demoTypes';
import { useReplayClock } from './useReplayClock';
import { advanceReplay, getFrameDuration, getReplayPhase } from '../domain/demo/replayTimeline';

interface PlaybackOptions {
  datasets: DemoDataset[];
  active: boolean;
  blocked: boolean; // Hộp thoại đang mở: không để đồng hồ tự chạy phía sau.
}

/**
 * Bộ điều khiển phát/dừng/chuyển tập. Chỉ cập nhật vị trí trình diễn.
 * Cần giải thích RNN tính h_t? Mở RecurrentMechanism và scripts/export_demo.py;
 * cần giải thích học trọng số? Mở mã PyTorch, không phải hook này.
 */
export function useDemoPlayback({ datasets, active, blocked }: PlaybackOptions) {
  const [index, setIndex] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [begun, setBegun] = useState(false);
  const [summary, setSummary] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [restart, setRestart] = useState(0);
  const [snapshot, setSnapshot] = useState(false);
  const data = datasets[index];
  const length = data?.lookback ?? 24;
  const timeline = getReplayPhase(frame, length);
  const pause = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    if (!active || blocked) pause();
  }, [active, blocked, pause]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause]);

  const advance = useCallback(() => {
    const next = advanceReplay({ index, frame }, length);
    setIndex(next.index);
    setFrame(next.frame);
    setPlaying(next.playing);
    setSummary(next.summary);
  }, [index, frame, length]);
  const progress = useReplayClock({
    position: `${index}:${frame}:${restart}`,
    duration: getFrameDuration(frame, length),
    speed,
    running: playing && frame <= length && !!data && !blocked && active && !summary,
    onComplete: advance,
  });

  const restartCurrent = useCallback(() => {
    setRestart((value) => value + 1);
    setSnapshot(false);
    setFrame(0);
    setBegun(true);
    setSummary(false);
    setPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    if (playing) return pause();
    if (summary) return setSummary(false);
    if (!begun || timeline.evaluated) return restartCurrent();
    if (timeline.predicted) {
      const next = advanceReplay({ index, frame }, length, true);
      setFrame(next.frame);
      setPlaying(false);
      return;
    }
    setSnapshot(false);
    setPlaying(true);
  }, [
    playing,
    pause,
    summary,
    begun,
    restartCurrent,
    timeline.evaluated,
    timeline.predicted,
    index,
    frame,
    length,
  ]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!active || blocked || !data || event.code !== 'Space' || event.repeat) return;
      const target = event.target as HTMLElement;
      // Giữ hành vi bàn phím sẵn có của nút, thanh tua và ô nhập.
      if (target.closest('button,a,input,select,textarea,[contenteditable="true"]')) return;
      event.preventDefault();
      toggle();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, blocked, data, toggle]);

  function choose(datasetIndex: number) {
    pause();
    setRestart((value) => value + 1);
    setSnapshot(false);
    setIndex(datasetIndex);
    setFrame(0);
    setBegun(true);
    setSummary(false);
  }

  function seek(nextFrame: number) {
    setRestart((value) => value + 1);
    setSnapshot(true); // Khi tua: hiển thị trọn trạng thái đã lưu, không để vector bay dở.
    setFrame(nextFrame);
    pause();
    setBegun(true);
  }

  function toggleSummary() {
    pause();
    setSummary((visible) => !visible);
  }

  function returnToDemo() {
    pause();
    setSummary(false);
  }

  let playLabel = 'Tiếp tục';
  if (playing) playLabel = 'Tạm dừng';
  else if (summary) playLabel = 'Về demo';
  else if (timeline.evaluated) playLabel = 'Chạy lại tập này';
  else if (timeline.revealed) playLabel = 'Xem toàn tập';
  else if (timeline.predicted) playLabel = 'Xem thực tế';
  else if (frame === 0) playLabel = 'Chạy tập này';

  return {
    ...timeline,
    data,
    index,
    frame,
    length,
    playing,
    begun,
    summary,
    speed,
    progress,
    snapshot,
    playLabel,
    pause,
    restartCurrent,
    toggle,
    choose,
    seek,
    toggleSummary,
    returnToDemo,
    setSpeed,
  };
}

export type DemoPlayback = ReturnType<typeof useDemoPlayback>;
