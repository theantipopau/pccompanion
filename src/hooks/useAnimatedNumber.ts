import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(value: number, duration = 260) {
  const [displayValue, setDisplayValue] = useState(value);
  const currentRef = useRef(value);

  useEffect(() => {
    if (!Number.isFinite(value)) {
      currentRef.current = 0;
      setDisplayValue(0);
      return;
    }

    const from = currentRef.current;
    if (Math.abs(value - from) < 0.05) {
      currentRef.current = value;
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const delta = value - from;
    const clampedDuration = Math.max(120, Math.min(duration, 520));

    function animate(now: number) {
      const progress = Math.min((now - start) / clampedDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + delta * eased;
      currentRef.current = next;
      setDisplayValue(next);
      if (progress < 1) frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return displayValue;
}
