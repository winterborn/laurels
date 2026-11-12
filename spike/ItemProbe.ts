import type { PlexItem } from './PlexClient.ts';

export type Presence = Record<string, boolean>;

export interface CoverageRow {
    field: string;
    present: number;
    total: number;
    percent: number;
}

// Turns Plex items into yes/no field checks, then counts them.
export class ItemProbe {

    static movie(item: PlexItem): Presence {
        return {
            genre: ItemProbe.hasList(item.Genre),
            director: ItemProbe.hasList(item.Director),
            cast: ItemProbe.hasList(item.Role),
            writer: ItemProbe.hasList(item.Writer),
            country: ItemProbe.hasList(item.Country),
            studio: ItemProbe.hasText(item.studio),
            collection: ItemProbe.hasList(item.Collection),
            imdbGuid: ItemProbe.hasGuid(item, 'imdb://'),
            tmdbGuid: ItemProbe.hasGuid(item, 'tmdb://'),
            criticRating: item.rating !== undefined,
            audienceRating: item.audienceRating !== undefined,
            contentRating: ItemProbe.hasText(item.contentRating),
            duration: Number(item.duration) > 0,
            releaseDate: ItemProbe.hasText(item.originallyAvailableAt),
            year: item.year !== undefined,
            art: ItemProbe.hasText(item.art),
            thumb: ItemProbe.hasText(item.thumb),
            creditsMarker: ItemProbe.hasMarker(item, 'credits'),
            chapters: ItemProbe.hasList(item.Chapter),
            chapterThumbs: ItemProbe.chapterThumb(item) !== '',
            previewThumbnails: ItemProbe.hasPreviews(item),
            audioLanguage: ItemProbe.audioLanguage(item) !== '',
        };
    }

    static episode(item: PlexItem): Presence {
        return {
            showKey: ItemProbe.hasText(item.grandparentRatingKey),
            seasonKey: ItemProbe.hasText(item.parentRatingKey),
            seasonIndex: item.parentIndex !== undefined,
            episodeIndex: item.index !== undefined,
            title: ItemProbe.hasText(item.title),
            airDate: ItemProbe.hasText(item.originallyAvailableAt),
            duration: Number(item.duration) > 0,
            thumb: ItemProbe.hasText(item.thumb),
            showArt: ItemProbe.hasText(item.grandparentArt),
            director: ItemProbe.hasList(item.Director),
            writer: ItemProbe.hasList(item.Writer),
            cast: ItemProbe.hasList(item.Role),
            introMarker: ItemProbe.hasMarker(item, 'intro'),
            creditsMarker: ItemProbe.hasMarker(item, 'credits'),
            previewThumbnails: ItemProbe.hasPreviews(item),
        };
    }

    static show(item: PlexItem): Presence {
        return {
            episodeCount: Number(item.leafCount) > 0,
            seasonCount: Number(item.childCount) > 0,
            genre: ItemProbe.hasList(item.Genre),
            network: ItemProbe.hasText(item.studio),
            contentRating: ItemProbe.hasText(item.contentRating),
            firstAired: ItemProbe.hasText(item.originallyAvailableAt),
            tvdbGuid: ItemProbe.hasGuid(item, 'tvdb://'),
            tmdbGuid: ItemProbe.hasGuid(item, 'tmdb://'),
            imdbGuid: ItemProbe.hasGuid(item, 'imdb://'),
            art: ItemProbe.hasText(item.art),
            thumb: ItemProbe.hasText(item.thumb),
        };
    }

    static season(item: PlexItem): Presence {
        return {
            episodeCount: Number(item.leafCount) > 0,
            seasonIndex: item.index !== undefined,
            showKey: ItemProbe.hasText(item.parentRatingKey),
            thumb: ItemProbe.hasText(item.thumb),
        };
    }

    static session(item: PlexItem): Presence {
        return {
            sessionKey: ItemProbe.hasText(item.sessionKey),
            userId: item.User?.id !== undefined,
            platform: ItemProbe.hasText(item.Player?.platform),
            playerState: ItemProbe.hasText(item.Player?.state),
            viewOffset: item.viewOffset !== undefined,
            duration: Number(item.duration) > 0,
            ratingKey: ItemProbe.hasText(item.ratingKey),
        };
    }

    static coverage(records: Presence[]): CoverageRow[] {
        const first = records[0];
        if (!first) {
            return [];
        }
        return Object.keys(first).map((field) => {
            return ItemProbe.countField(records, field);
        });
    }

    static chapterThumb(item: PlexItem): string {
        const chapters: PlexItem[] = item.Chapter ?? [];
        const withThumb = chapters.find((chapter) => chapter.thumb);
        return String(withThumb?.thumb ?? '');
    }

    static audioLanguage(item: PlexItem): string {
        const streams: PlexItem[] = ItemProbe.firstPart(item)?.Stream ?? [];
        const audio = streams.find((stream) => stream.streamType === 2);
        return String(audio?.languageCode ?? '');
    }

    private static countField(records: Presence[], field: string): CoverageRow {
        const present = records.filter((record) => record[field]).length;
        const total = records.length;
        return {
            field,
            present,
            total,
            percent: Math.round(100 * present / total),
        };
    }

    private static firstPart(item: PlexItem): PlexItem | undefined {
        const media = item.Media?.[0];
        return media?.Part?.[0];
    }

    // Plex sets indexes="sd" when preview (BIF) thumbnails exist.
    private static hasPreviews(item: PlexItem): boolean {
        const part = ItemProbe.firstPart(item);
        return part?.indexes === 'sd';
    }

    private static hasMarker(item: PlexItem, type: string): boolean {
        const markers: PlexItem[] = item.Marker ?? [];
        return markers.some((marker) => marker.type === type);
    }

    private static hasGuid(item: PlexItem, prefix: string): boolean {
        const guids: PlexItem[] = item.Guid ?? [];
        return guids.some((guid) => String(guid.id).startsWith(prefix));
    }

    private static hasList(value: unknown): boolean {
        return Array.isArray(value) && value.length > 0;
    }

    private static hasText(value: unknown): boolean {
        return value !== undefined && value !== null && String(value) !== '';
    }

}
