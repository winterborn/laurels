import { FILMS } from './data/films.ts';
import type { MockFilm } from './data/films.ts';
import { SHOWS } from './data/shows.ts';
import type { MockShow } from './data/shows.ts';

export type PlexJson = Record<string, any>;

export interface PosterSource {
    file?: string;
    title: string;
    year: number;
    credit: string;
}

const FIRST_FILM_KEY = 101;

// Plex-shaped metadata for the mock films and shows.
export class MockLibrary {

    private readonly metadata = new Map<string, PlexJson>();
    private readonly posters = new Map<string, PosterSource>();

    constructor() {
        FILMS.forEach((film, index) => this.addFilm(film, FIRST_FILM_KEY + index));
        SHOWS.forEach((show) => this.addShow(show));
    }

    get(ratingKey: string): PlexJson | undefined {
        return this.metadata.get(ratingKey);
    }

    children(ratingKey: string): PlexJson[] {
        const all = [...this.metadata.values()];
        return all.filter((entry) => String(entry.parentRatingKey) === ratingKey);
    }

    posterOf(ratingKey: string): PosterSource | undefined {
        return this.posters.get(ratingKey);
    }

    filmKey(title: string): string {
        const index = FILMS.findIndex((film) => film.title === title);
        if (index < 0) {
            throw new Error(`No mock film "${title}"`);
        }
        return String(FIRST_FILM_KEY + index);
    }

    showByTitle(title: string): MockShow {
        const show = SHOWS.find((candidate) => candidate.title === title);
        if (!show) {
            throw new Error(`No mock show "${title}"`);
        }
        return show;
    }

    private addFilm(film: MockFilm, key: number): void {
        const ratingKey = String(key);
        this.metadata.set(ratingKey, {
            ratingKey,
            key: `/library/metadata/${ratingKey}`,
            type: 'movie',
            title: film.title,
            year: film.year,
            duration: film.minutes * 60_000,
            studio: film.studio,
            contentRating: 'PG',
            originallyAvailableAt: `${film.year}-01-01`,
            thumb: `/library/metadata/${ratingKey}/thumb/1`,
            Genre: this.tags(film.genres),
            Director: this.tags(film.directors),
            Role: this.tags(film.actors),
            Country: this.tags([film.country]),
        });
        this.posters.set(ratingKey, {
            file: film.poster,
            title: film.title,
            year: film.year,
            credit: `A film by ${film.directors[0]}`,
        });
    }

    private addShow(show: MockShow): void {
        const showKey = String(show.ratingKey);
        const episodes = show.seasons * show.episodesPerSeason;
        this.metadata.set(showKey, {
            ratingKey: showKey,
            type: 'show',
            title: show.title,
            year: show.year,
            studio: show.studio,
            leafCount: episodes,
            childCount: show.seasons,
            thumb: `/library/metadata/${showKey}/thumb/1`,
            Genre: this.tags(show.genres),
        });
        this.posters.set(showKey, {
            file: show.poster,
            title: show.title,
            year: show.year,
            credit: show.studio,
        });
        for (const season of this.range(show.seasons)) {
            this.addSeason(show, season);
        }
    }

    private addSeason(show: MockShow, season: number): void {
        const seasonKey = String(show.ratingKey + 10 * season);
        this.metadata.set(seasonKey, {
            ratingKey: seasonKey,
            type: 'season',
            title: `Season ${season}`,
            index: season,
            parentRatingKey: show.ratingKey,
            parentTitle: show.title,
            leafCount: show.episodesPerSeason,
            thumb: `/library/metadata/${show.ratingKey}/thumb/1`,
        });
        for (const episode of this.range(show.episodesPerSeason)) {
            this.addEpisode(show, season, episode);
        }
    }

    private addEpisode(show: MockShow, season: number, episode: number): void {
        const ratingKey = String(show.ratingKey + 100 * season + episode);
        this.metadata.set(ratingKey, {
            ratingKey,
            key: `/library/metadata/${ratingKey}`,
            type: 'episode',
            title: `Chapter ${episode}`,
            index: episode,
            parentIndex: season,
            parentRatingKey: show.ratingKey + 10 * season,
            grandparentRatingKey: show.ratingKey,
            grandparentTitle: show.title,
            duration: show.minutes * 60_000,
            thumb: `/library/metadata/${show.ratingKey}/thumb/1`,
        });
    }

    private range(count: number): number[] {
        return Array.from({ length: count }, (_, index) => index + 1);
    }

    private tags(values: string[]): PlexJson[] {
        return values.map((tag) => ({ tag }));
    }

}
