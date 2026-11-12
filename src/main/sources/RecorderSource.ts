import type {
    Play,
    RecordedPlay,
} from '../model/index.ts';
import {
    groupBy,
    isWatchedAt,
} from '../helpers/index.ts';
import type { Store } from '../store/index.ts';
import {
    PlayLinker,
    type PlayReport,
} from './PlayLinker.ts';

const PLAY_PREFIX = 'recorder:';

// Turns the plays that the session recorder saved into grouped plays,
// with the same sums as Tautulli's grouped history:
// - started is MIN(started), stopped is MAX(stopped),
// - time on screen is SUM(stopped - started) - SUM(paused),
// - watched, device and item come from the row that is furthest on (MAX(percent)).
// PlayLinker then joins the plays to Plex watches.
export class RecorderSource {

    private readonly store: Store;

    constructor(store: Store) {
        this.store = store;
    }

    async sync(): Promise<PlayReport> {
        const groups = groupBy(this.store.recordedPlays(), (play) => String(play.referenceId));
        const plays = [...groups.entries()].map(([referenceId, rows]) => this.playFrom(referenceId, rows));
        const changed = this.store.savePlays(plays);
        const changedIds = new Set(changed.map((play) => play.id));
        return {
            newPlays: changed.length,
            changedWatches: new PlayLinker(this.store).apply(changedIds),
        };
    }

    private playFrom(referenceId: string, rows: RecordedPlay[]): Play {
        const furthest = rows.reduce((best, row) => (this.percentOf(row) > this.percentOf(best) ? row : best));
        const pausedSeconds = rows.reduce((sum, row) => sum + row.pausedSeconds, 0);
        const spanSeconds = rows.reduce((sum, row) => sum + (row.stopped - row.started), 0);
        return {
            id: `${PLAY_PREFIX}${referenceId}`,
            userId: furthest.userId,
            ratingKey: furthest.ratingKey,
            kind: furthest.kind,
            title: furthest.title,
            showKey: furthest.showKey,
            seasonKey: furthest.seasonKey,
            showTitle: furthest.showTitle,
            year: furthest.year,
            index: furthest.index,
            seasonIndex: furthest.seasonIndex,
            thumb: furthest.thumb,
            durationMs: furthest.durationMs,
            started: Math.min(...rows.map((row) => row.started)),
            stopped: Math.max(...rows.map((row) => row.stopped)),
            playSeconds: Math.max(0, spanSeconds - pausedSeconds),
            pausedSeconds,
            platform: furthest.platform,
            watched: isWatchedAt(furthest.viewOffsetMs, furthest.durationMs, furthest.creditsFirstMs),
        };
    }

    private percentOf(row: RecordedPlay): number {
        return row.durationMs ? row.viewOffsetMs / row.durationMs : 0;
    }

}
