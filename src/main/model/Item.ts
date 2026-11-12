export type ItemKind = 'movie' | 'episode' | 'show' | 'season';

export interface Item {
    ratingKey: string;
    kind: ItemKind;
    title: string;
    year?: number;
    durationMs?: number;
    genres: string[];
    directors: string[];
    actors: string[];
    studio?: string;
    countries: string[];
    contentRating?: string;
    // YYYY-MM-DD
    releasedAt?: string;
    showKey?: string;
    seasonKey?: string;
    index?: number;
    seasonIndex?: number;
    // Episodes in the library (shows and seasons).
    leafCount?: number;
    thumb?: string;
    // Backdrop still. Episodes use their show's backdrop.
    art?: string;
    collections: string[];
    // Version of the fields read from Plex. An older version is read again.
    metaVersion?: number;
    // Built from a history row; full metadata not fetched yet.
    stub?: boolean;
    // Plex no longer has it. Kept from the history row.
    missing?: boolean;
}
