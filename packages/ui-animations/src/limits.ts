/**
 * Bounds the Studio schema puts on scene values, shared by `normalizeScene`
 * (which clamps to them) and `validateScene` (which reports them).
 */

/** Smallest window, design px. */
export const MIN_WINDOW_W = 120;
export const MIN_WINDOW_H = 80;

/** Longest `delayMs` or `durationMs`, ms. */
export const MAX_STEP_MS = 5000;
