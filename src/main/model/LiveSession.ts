import type { WatchKind } from './WatchEvent.ts';

// What Plex says about one playing session (from /status/sessions).
export interface SessionInfo {
    sessionKey: string;
    ratingKey: string;
    userId: string;
    kind: WatchKind;
    title: string;
    showTitle?: string;
    showKey?: string;
    seasonKey?: string;
    year?: number;
    index?: number;
    seasonIndex?: number;
    thumb?: string;
    guid: string;
    durationMs: number;
    viewOffsetMs: number;
    state: string;
    platform?: string;
    isLive: boolean;
}

// A session that the recorder follows, like a row in Tautulli's sessions table.
export interface LiveSession extends SessionInfo {
    creditsFirstMs?: number;
    // Epoch seconds.
    started: number;
    // The last time the recorder wrote the session. Tautulli calls it "stopped".
    updated: number;
    // The last event from Plex. After 5 minutes with no event, the session stops.
    lastEvent: number;
    pausedSince?: number;
    pausedSeconds: number;
}

// One finished session, like a row in Tautulli's session_history table.
export interface RecordedPlay extends LiveSession {
    id: number;
    // The first play of the group. A resumed play joins the group of the play before it.
    referenceId: number;
    stopped: number;
}
