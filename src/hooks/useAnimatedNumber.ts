import { useEffect, useState } from 'react';

export function useAnimatedNumber(value: number, duration = 260) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = displayValue;
    const delta = value - from;

    function animate(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + delta * eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return displayValue;
}
