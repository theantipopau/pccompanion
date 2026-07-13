import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

type AnimatedValueProps = {
  value: number;
  format: (value: number) => string;
  duration?: number;
};

/** Tweens a raw number through `useAnimatedNumber` before handing it to `format` — so readouts count instead of hard-jumping. */
export function AnimatedValue({ value, format, duration }: AnimatedValueProps) {
  const animated = useAnimatedNumber(value, duration);
  return <>{format(animated)}</>;
}
