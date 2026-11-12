// Tautulli's defaults. Laurels uses the same values, so the results agree.
// Tautulli does not keep a film or episode play shorter than this.
export const IGNORE_SECONDS = 120;
// A play is watched at this share of the running time.
export const WATCHED_PERCENT = 85;
// A stop within this time of the end counts as a stop at the end.
export const END_MARGIN_MS = 10_000;

// Tautulli's check_watched with its default marker mode (3):
// the view offset reaches the watched percent of the running time,
// or the first credits marker if that comes earlier.
export function isWatchedAt(viewOffsetMs: number, durationMs: number, creditsFirstMs?: number): boolean {
    const threshold = (WATCHED_PERCENT / 100) * durationMs;
    if (!threshold) {
        return false;
    }
    const limit = creditsFirstMs ? Math.min(threshold, creditsFirstMs) : threshold;
    return viewOffsetMs >= limit;
}
