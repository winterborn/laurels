import type { WatchKind } from './WatchEvent.ts';

// One play from Tautulli history, grouped as Tautulli groups it:
// a resumed play joins the play before it (one reference_id).
export interface Play {
    // Tautulli reference_id.
    id: string;
    userId: string;
    ratingKey: string;
    kind: WatchKind;
    title: string;
    showKey?: string;
    seasonKey?: string;
    showTitle?: string;
    year?: number;
    // Episode number in its season, and the season number.
    index?: number;
    seasonIndex?: number;
    thumb?: string;
    durationMs?: number;
    // Epoch seconds. MIN(started) and MAX(stopped) of the group.
    started: number;
    stopped: number;
    // SUM(stopped - started) - SUM(paused_counter) of the group.
    playSeconds: number;
    pausedSeconds: number;
    platform?: string;
    // Tautulli watched_status = 1: watched to its watched percent or its credits marker.
    watched: boolean;
    // The Laurels watch that this play belongs to, once matched.
    eventId?: string;
}
