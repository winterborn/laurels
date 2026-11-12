export type WatchKind = 'movie' | 'episode';

export type WatchSource = 'plex' | 'recorder' | 'tautulli';

export interface WatchEvent {
    id: string;
    userId: string;
    ratingKey: string;
    kind: WatchKind;
    showKey?: string;
    seasonKey?: string;
    // Epoch seconds. Plex history: roughly the end of the watch.
    watchedAt: number;
    startedAt?: number;
    playSeconds?: number;
    pausedSeconds?: number;
    platform?: string;
    source: WatchSource;
    // A Tautulli play that was not watched to the end. It adds time on screen only.
    partial?: boolean;
}
