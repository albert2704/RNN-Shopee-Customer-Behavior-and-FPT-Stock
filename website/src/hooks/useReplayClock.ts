import { useEffect, useRef, useState } from 'react';
import { advanceClock } from '../domain/demo/stateHandover';

interface ClockOptions {
  position: string;
  duration: number;
  speed: number;
  running: boolean;
  onComplete: () => void;
}

/** Một đồng hồ dùng chung cho biểu đồ và chuyển trạng thái; dừng là đóng băng tại chỗ. */
export function useReplayClock({ position, duration, speed, running, onComplete }: ClockOptions) {
  const clock = useRef({ position, elapsed: 0 });
  const [display, setDisplay] = useState(clock.current);

  useEffect(() => {
    if (clock.current.position !== position) {
      clock.current = { position, elapsed: 0 };
      setDisplay(clock.current);
    }
    if (!running) return;
    let handle = 0;
    let previous = performance.now();
    let cancelled = false;
    function tick(now: number) {
      if (cancelled) return;
      // Tab bị ẩn sẽ được pause bởi controller. Không bù một quãng dài khi tab quay lại.
      const delta = Math.min(now - previous, 100);
      previous = now;
      const elapsed = advanceClock(clock.current.elapsed, delta, speed, duration);
      clock.current = { position, elapsed };
      setDisplay(clock.current);
      if (elapsed >= duration) onComplete();
      else handle = requestAnimationFrame(tick);
    }
    handle = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  }, [position, duration, speed, running, onComplete]);

  return display.position === position ? display.elapsed / duration : 0;
}
