import { useEffect, useState } from 'react';

/**
 * Đồng hồ trình bày ví dụ SGD, không phải vòng lặp huấn luyện mô hình thật.
 * Hook nằm ở controller nên đổi chủ đề chỉ dừng, không mất bước đang xem.
 */
export default function useTrainingReplay(trainingVisible: boolean) {
  const [phase, setPhase] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || !trainingVisible) return;

    const timer = window.setTimeout(() => {
      if (phase < 3) setPhase((value) => value + 1);
      else setRunning(false);
    }, 2200);

    // Dọn bộ hẹn giờ khi đổi chủ đề, phát lại hoặc đóng phần giải thích.
    return () => window.clearTimeout(timer);
  }, [running, phase, trainingVisible]);

  function train() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase(3);
      setRunning(false);
      return;
    }

    setPhase(1);
    setRunning(true);
  }

  function stop() {
    setRunning(false);
  }

  return { phase, running, train, stop };
}
