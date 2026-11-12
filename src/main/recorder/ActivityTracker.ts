import type {
    LiveSession,
    RecordedPlay,
    SessionInfo,
} from '../model/index.ts';
import {
    END_MARGIN_MS,
    IGNORE_SECONDS,
    isWatchedAt,
} from '../helpers/index.ts';
import type { Store } from '../store/index.ts';

// One "playing" notification from the Plex websocket.
export interface Timeline {
    sessionKey?: string | number;
    ratingKey?: string | number;
    state?: string;
    viewOffset?: number;
}

// Reads the current sessions and the credits markers from Plex.
export interface SessionReader {
    currentSessions(): Promise<SessionInfo[]>;
    creditsStart(ratingKey: string): Promise<number | undefined>;
}

// Tautulli writes a playing session again only after this many seconds.
const UPDATE_SECONDS = 60;
// Tautulli stops a session that sent no event for this many seconds.
const STALE_SECONDS = 5 * 60;

// Follows Plex sessions the way Tautulli's ActivityHandler and ActivityProcessor do:
// - The first event of a session starts it, with the session details from Plex.
// - A pause sets pausedSince. A resume or a stop adds the pause to pausedSeconds.
// - A stop near the end (10 s) counts as a stop at the end.
// - A session with no event for 5 minutes stops at its last update.
// - A new item in the same session stops the old play and starts a new one.
// - A finished film or episode under 120 s is not kept.
// - A resumed play joins the group of the play before it, if that play was
//   not watched and the new play is further on.
export class ActivityTracker {

    private readonly store: Store;
    private readonly reader: SessionReader;
    private readonly now: () => number;

    constructor(
        store: Store,
        reader: SessionReader,
        now = () => Math.floor(Date.now() / 1000),
    ) {
        this.store = store;
        this.reader = reader;
        this.now = now;
    }

    // ActivityHandler.process: one websocket event.
    async process(timeline: Timeline): Promise<void> {
        const sessionKey = String(timeline.sessionKey ?? '');
        if (!/^\d+$/.test(sessionKey)) {
            return;
        }
        const saved = this.store.liveSession(sessionKey);
        if (!saved) {
            await this.startUnlessBuffering(timeline, sessionKey);
            return;
        }
        const session = {
            ...saved,
            lastEvent: this.now(),
        };
        const isSameItem = String(timeline.ratingKey ?? '') === session.ratingKey;
        if (isSameItem) {
            this.followState(session, timeline);
        } else {
            this.stop(session, timeline, true);
            await this.start(sessionKey, timeline);
        }
    }

    // Stops every session that sent no event for 5 minutes.
    stopStale(): void {
        const now = this.now();
        const stale = this.store
            .liveSessions()
            .filter((session) => now - session.lastEvent >= STALE_SECONDS);
        for (const session of stale) {
            this.dropStale(session);
        }
    }

    // check_active_sessions: runs when the websocket connects.
    // It stops saved sessions that Plex no longer has, and starts new ones.
    async reconcile(): Promise<void> {
        const current = await this.reader.currentSessions();
        const saved = this.store.liveSessions();
        const currentKeys = new Set(current.map((info) => this.keyOf(info)));
        const savedKeys = new Set(saved.map((session) => this.keyOf(session)));
        const gone = saved.filter((session) => !currentKeys.has(this.keyOf(session)));
        const added = current.filter((info) => !savedKeys.has(this.keyOf(info)));
        for (const session of gone) {
            this.dropStale(session);
        }
        for (const info of added) {
            await this.startFrom(info);
        }
    }

    private async startUnlessBuffering(timeline: Timeline, sessionKey: string): Promise<void> {
        if (timeline.state === 'buffering') {
            return;
        }
        await this.start(sessionKey, timeline);
    }

    // on_start: needs the session details from /status/sessions.
    private async start(sessionKey: string, timeline: Timeline): Promise<void> {
        const current = await this.reader.currentSessions();
        const info = current.find((entry) => entry.sessionKey === sessionKey);
        if (!info) {
            return;
        }
        await this.startFrom({
            ...info,
            state: timeline.state ?? info.state,
            viewOffsetMs: timeline.viewOffset ?? info.viewOffsetMs,
        });
    }

    private async startFrom(info: SessionInfo): Promise<void> {
        const now = this.now();
        const creditsFirstMs = info.isLive ? undefined : await this.reader.creditsStart(info.ratingKey);
        this.store.saveLiveSession({
            ...info,
            creditsFirstMs,
            started: now,
            updated: now,
            lastEvent: now,
            pausedSince: info.state === 'paused' ? now : undefined,
            pausedSeconds: 0,
        });
    }

    // The state checks of ActivityHandler.process for the same item.
    private followState(session: LiveSession, timeline: Timeline): void {
        const state = timeline.state ?? session.state;
        const viewOffsetMs = timeline.viewOffset ?? session.viewOffsetMs;
        const isNewState = state !== session.state;
        if (isNewState) {
            this.changeState(session, state, viewOffsetMs, timeline);
        } else {
            this.keepState(session, state, viewOffsetMs);
        }
    }

    private changeState(session: LiveSession, state: string, viewOffsetMs: number, timeline: Timeline): void {
        switch (state) {
            case 'paused':
                this.pause(session, viewOffsetMs);
                return;
            case 'playing':
                this.resumeOrPlay(session, viewOffsetMs);
                return;
            case 'stopped':
                this.stop(session, timeline, false);
                return;
            default:
                this.setState(session, state, viewOffsetMs);
        }
    }

    // Plex sends an event every 10 s. Tautulli writes the row once a minute.
    private keepState(session: LiveSession, state: string, viewOffsetMs: number): void {
        const isDue = this.now() - session.updated > UPDATE_SECONDS;
        if (state === 'paused' && isDue) {
            this.pause(session, viewOffsetMs);
        } else if (state === 'playing' && isDue) {
            this.setState(session, state, viewOffsetMs);
        } else {
            this.store.saveLiveSession(session);
        }
    }

    // set_session_last_paused(now): adds any open pause, then starts a new one.
    private pause(session: LiveSession, viewOffsetMs: number): void {
        const now = this.now();
        this.setState({
            ...session,
            pausedSeconds: this.withOpenPause(session, now),
            pausedSince: now,
        }, 'paused', viewOffsetMs);
    }

    private resumeOrPlay(session: LiveSession, viewOffsetMs: number): void {
        this.setState({
            ...session,
            pausedSeconds: this.withOpenPause(session, this.now()),
            pausedSince: undefined,
        }, 'playing', viewOffsetMs);
    }

    private setState(session: LiveSession, state: string, viewOffsetMs: number): void {
        this.store.saveLiveSession({
            ...session,
            state,
            viewOffsetMs,
            updated: this.now(),
        });
    }

    // force_stop_stream: the last update is the stop time.
    // Tautulli does not add an open pause here.
    private dropStale(session: LiveSession): void {
        this.writeHistory(session);
        this.store.deleteLiveSession(session.sessionKey);
    }

    // on_stop. A forced stop (a new item in the session) keeps the last update
    // as the stop time and the last view offset.
    private stop(session: LiveSession, timeline: Timeline, isForced: boolean): void {
        const now = this.now();
        const closed = {
            ...session,
            pausedSeconds: this.withOpenPause(session, now),
            pausedSince: undefined,
        };
        const finished = isForced ? closed : this.atStop(closed, timeline, now);
        this.writeHistory(finished);
        this.store.deleteLiveSession(session.sessionKey);
    }

    private atStop(session: LiveSession, timeline: Timeline, now: number): LiveSession {
        const viewOffsetMs = timeline.viewOffset ?? session.viewOffsetMs;
        const isAtEnd = session.durationMs > 0 && session.durationMs - viewOffsetMs <= END_MARGIN_MS;
        return {
            ...session,
            state: 'stopped',
            viewOffsetMs: isAtEnd ? session.durationMs : viewOffsetMs,
            updated: now,
        };
    }

    private withOpenPause(session: LiveSession, now: number): number {
        if (session.pausedSince === undefined) {
            return session.pausedSeconds;
        }
        return session.pausedSeconds + (now - session.pausedSince);
    }

    // write_session_history: films and episodes only, no live TV, nothing under 120 s.
    private writeHistory(session: LiveSession): void {
        const isVideo = session.kind === 'movie' || session.kind === 'episode';
        const hasItem = /^\d+$/.test(session.ratingKey);
        const playSeconds = session.updated - session.started - session.pausedSeconds;
        const canKeep = isVideo && hasItem && !session.isLive && playSeconds >= IGNORE_SECONDS;
        if (!canKeep) {
            return;
        }
        const play = this.store.addRecordedPlay(session, session.updated);
        this.group(play);
    }

    // group_history: compares the new play with the play before it.
    private group(play: RecordedPlay): void {
        const [, previous] = this.store.lastRecordedPlays(play.userId, play.ratingKey, 2);
        if (!previous) {
            return;
        }
        const wasWatched = isWatchedAt(previous.viewOffsetMs, previous.durationMs, previous.creditsFirstMs);
        const isFurther = previous.viewOffsetMs <= play.viewOffsetMs;
        const isOtherItem = previous.guid !== '' && play.guid !== '' && previous.guid !== play.guid;
        const canJoin = !wasWatched && isFurther && !isOtherItem;
        if (canJoin) {
            this.store.saveRecordedPlay({
                ...play,
                referenceId: previous.referenceId,
            });
        }
    }

    private keyOf(session: SessionInfo): string {
        return `${session.sessionKey}|${session.ratingKey}`;
    }

}
