import { groupBy } from '../helpers/index.ts';
import type {
    Item,
    WatchEvent,
} from '../model/index.ts';

// The watches that can win awards, and the plays that add time on screen only.
export interface CheckedWatches {
    watches: WatchEvent[];
    partialPlays: WatchEvent[];
}

// Epoch seconds.
interface Span {
    start: number;
    end: number;
}

// Plex can mark a watch a little before the Tautulli play starts.
const BEFORE_START = 60;
// With Tautulli, a watch counts after this share of its running time on screen.
const MIN_SCREEN_SHARE = 0.7;
// Trailers, clips and other short items add time on screen only.
const MIN_RUNTIME_SECONDS = 5 * 60;
// Two watches that share more than this part of the shorter one count once.
const MAX_OVERLAP_SHARE = 0.5;
// Only watches that started this close together can overlap.
const MAX_WATCH_SECONDS = 12 * 3600;

// Decides which watches can win awards. A watch that fails a check becomes a
// partial play. These checks apply in this order:
// 1. The running time is 5 minutes or more.
// 2. With Tautulli: the person was on screen for 70% of the running time, or more.
//    This adds all plays of the item since the last watch that counted.
//    A Plex watch with no Tautulli play has no time on screen.
// 3. The watch does not overlap a watch that counted by more than half of the shorter one.
//    Without Tautulli, the start is the end minus the running time.
// An item with no known running time passes checks 1 and 2.
export class WatchCheck {

    private readonly items: Map<string, Item>;

    constructor(items: Map<string, Item>) {
        this.items = items;
    }

    apply(watches: WatchEvent[], partialPlays: WatchEvent[]): CheckedWatches {
        const tautulli = this.tautulliSpan([...watches, ...partialPlays]);
        const partialByUser = groupBy(partialPlays, (event) => event.userId);
        const results = [...groupBy(watches, (event) => event.userId).entries()]
            .map(([userId, events]) => this.checkUser(events, partialByUser.get(userId) ?? [], tautulli));
        return {
            watches: results.flatMap((result) => result.watches),
            partialPlays: [...partialPlays, ...results.flatMap((result) => result.partialPlays)],
        };
    }

    // Partial plays in the result are only the watches that failed.
    private checkUser(
        watches: WatchEvent[],
        partialPlays: WatchEvent[],
        tautulli: Span | undefined,
    ): CheckedWatches {
        const long = watches.filter((event) => this.isLongEnough(event));
        const short = watches.filter((event) => !this.isLongEnough(event));
        const screened = this.checkScreenTime(long, partialPlays, tautulli);
        const kept = this.withoutOverlaps(screened.watches);
        const overlapping = screened.watches
            .filter((event) => !kept.includes(event))
            .map((event) => this.demote(event, 0));
        const tooShort = short.map((event) => this.demote(event, event.playSeconds));
        return {
            watches: kept,
            partialPlays: [...tooShort, ...screened.partialPlays, ...overlapping],
        };
    }

    private isLongEnough(event: WatchEvent): boolean {
        const runtime = this.runtimeOf(event);
        return runtime === 0 || runtime >= MIN_RUNTIME_SECONDS;
    }

    // Check 2. Plays of each item add up until a watch of that item counts.
    private checkScreenTime(
        watches: WatchEvent[],
        partialPlays: WatchEvent[],
        tautulli: Span | undefined,
    ): CheckedWatches {
        const onScreen = new Map<string, number>();
        const passed: WatchEvent[] = [];
        const failed: WatchEvent[] = [];
        const all = [...watches, ...partialPlays].sort((a, b) => a.watchedAt - b.watchedAt);
        for (const event of all) {
            const seconds = (onScreen.get(event.ratingKey) ?? 0) + (event.playSeconds ?? 0);
            if (event.partial) {
                onScreen.set(event.ratingKey, seconds);
            } else if (this.hasScreenTime(event, seconds, tautulli)) {
                onScreen.delete(event.ratingKey);
                passed.push(event);
            } else {
                onScreen.set(event.ratingKey, seconds);
                failed.push(this.demote(event, event.playSeconds ?? 0));
            }
        }
        return {
            watches: passed,
            partialPlays: failed,
        };
    }

    private hasScreenTime(event: WatchEvent, seconds: number, tautulli: Span | undefined): boolean {
        const runtime = this.runtimeOf(event);
        const isTracked = this.isInside(event.watchedAt, tautulli);
        if (!isTracked || runtime === 0) {
            return true;
        }
        return seconds >= runtime * MIN_SCREEN_SHARE;
    }

    // Check 3. The earlier watch counts. The later one does not.
    private withoutOverlaps(watches: WatchEvent[]): WatchEvent[] {
        const spans = new Map(watches.map((event) => [event, this.spanOf(event)]));
        const sorted = [...watches].sort((a, b) => (spans.get(a) as Span).start - (spans.get(b) as Span).start);
        const kept: Span[] = [];
        const keptEvents: WatchEvent[] = [];
        for (const event of sorted) {
            const span = spans.get(event) as Span;
            const clashes = this.recentOf(kept, span).some((other) => this.isOverlap(other, span));
            if (!clashes) {
                kept.push(span);
                keptEvents.push(event);
            }
        }
        return keptEvents;
    }

    // The kept spans that started within MAX_WATCH_SECONDS before this one. They are sorted by start.
    private recentOf(kept: Span[], span: Span): Span[] {
        const earliest = span.start - MAX_WATCH_SECONDS;
        const firstIndex = kept.findLastIndex((other) => other.start < earliest) + 1;
        return kept.slice(firstIndex);
    }

    private isOverlap(first: Span, second: Span): boolean {
        const shared = Math.min(first.end, second.end) - Math.max(first.start, second.start);
        const shorter = Math.min(first.end - first.start, second.end - second.start);
        return shorter > 0 && shared > shorter * MAX_OVERLAP_SHARE;
    }

    // From the start of the first Tautulli play to the end of the last one.
    // Without Tautulli, no watch has a start time, and the result is undefined.
    private tautulliSpan(events: WatchEvent[]): Span | undefined {
        const timed = events.filter((event) => event.startedAt !== undefined);
        if (!timed.length) {
            return undefined;
        }
        const start = timed.reduce((first, event) => Math.min(first, event.startedAt as number), Infinity);
        const end = timed.reduce((last, event) => Math.max(last, event.watchedAt), 0);
        return {
            start: start - BEFORE_START,
            end,
        };
    }

    private isInside(time: number, span: Span | undefined): boolean {
        if (!span) {
            return false;
        }
        return time >= span.start && time <= span.end;
    }

    private spanOf(event: WatchEvent): Span {
        const start = event.startedAt ?? event.watchedAt - this.runtimeOf(event);
        return {
            start,
            end: event.watchedAt,
        };
    }

    private runtimeOf(event: WatchEvent): number {
        const durationMs = this.items.get(event.ratingKey)?.durationMs ?? 0;
        return Math.round(durationMs / 1000);
    }

    // A failed watch adds this many seconds of time on screen.
    // Undefined means the running time (a watch from Plex only).
    private demote(event: WatchEvent, playSeconds: number | undefined): WatchEvent {
        return {
            ...event,
            playSeconds,
            partial: true,
        };
    }

}
