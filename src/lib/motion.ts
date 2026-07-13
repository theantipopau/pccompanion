/**
 * Shared Framer Motion easing curves — the JS-side mirror of the CSS custom properties
 * `--ease-out`/`--ease-spring` in styles.css. Framer Motion transitions can't read CSS
 * custom properties, so this is the single source of truth for keeping every JS-driven
 * animation curve in sync with the CSS-driven ones instead of hand-copied array literals.
 */
export const EASE_OUT = [0.2, 0, 0.13, 1] as const;
export const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const;
export const EASE_IN_OUT = [0.45, 0, 0.15, 1] as const;

/** Dedicated curve for the top-level route/page transition in App.tsx — not a design token, kept separate so it can be tuned independently of everyday UI micro-interactions. */
export const EASE_PAGE_TRANSITION = [0.22, 1, 0.36, 1] as const;
