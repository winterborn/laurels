import type { App } from '../App.ts';
import {
    groupBy,
    localParts,
} from '../helpers/index.ts';
import type {
    User,
    WatchEvent,
} from '../model/index.ts';
import type { UserHistory } from '../rules/index.ts';

type Json = Record<string, unknown>;

const SHARE_WINDOW_DAYS = 7;
const GENRE_POSTERS = 3;
const GENRES_SHOWN = 3;

// Year in film: one person, one calendar year.
export class RecapReport {

    private readonly app: App;

    constructor(app: App) {
        this.app = app;
    }

    build(userId: string, wantedYear: string | undefined): Json | null {
        const user = this.app.visibleUsers().find((candidate) => candidate.id === userId);
        if (!user) {
            return null;
        }
        const history = this.app.historyOf(user.id);
        const years = this.yearsOf(history);
        const year = wantedYear && years.includes(wantedYear) ? wantedYear : years[years.length - 1];
        if (!year) {
            return {
                user: this.person(user),
                years,
                year: null,
            };
        }
        const events = history.events.filter((event) => this.yearOf(history, event) === year);
        return {
            user: this.person(user),
            years,
            year,
            isCurrentYear: year === this.yearAt(Date.now() / 1000),
            totals: this.totals(history, events, user.id, year),
            months: this.months(history, events),
            filmMonths: this.months(history, events.filter((event) => event.kind === 'movie')),
            tvMonths: this.months(history, events.filter((event) => event.kind === 'episode')),
            genres: this.genres(history, events),
            moments: this.moments(history, events, user),
            won: this.won(user.id, year),
        };
    }

    private person(user: User): Json {
        return {
            id: user.id,
            name: user.name,
        };
    }

    private yearsOf(history: UserHistory): string[] {
        const years = new Set(history.events.map((event) => this.yearOf(history, event)));
        return [...years].sort();
    }

    // A watch belongs to the day it started, the same day the rules use.
    private yearOf(history: UserHistory, event: WatchEvent): string {
        return history.localStart(event).day.slice(0, 4);
    }

    private monthOf(history: UserHistory, event: WatchEvent): number {
        const day = history.localStart(event).day;
        return Number(day.slice(5, 7)) - 1;
    }

    private yearAt(epochSeconds: number): string {
        return localParts(epochSeconds, this.app.settings.timeZone).day.slice(0, 4);
    }

    private totals(history: UserHistory, events: WatchEvent[], userId: string, year: string): Json {
        const seconds = events.reduce((sum, event) => sum + history.secondsOf(event), 0);
        return {
            films: events.filter((event) => event.kind === 'movie').length,
            episodes: events.filter((event) => event.kind === 'episode').length,
            hours: Math.round(seconds / 3600),
            trophies: this.awardsIn(userId, year).length,
        };
    }

    // Watches in each month, January first.
    private months(history: UserHistory, events: WatchEvent[]): number[] {
        const counts = Array.from({ length: 12 }, () => 0);
        for (const event of events) {
            counts[this.monthOf(history, event)] += 1;
        }
        return counts;
    }

    // Genres by title: each film once and each show once, so a long show
    // counts as one title, not as many episodes.
    private genres(history: UserHistory, events: WatchEvent[]): Json[] {
        const titles = this.titlesOf(history, events);
        const pairs = titles.flatMap((title) => history.genresOf(title.event).map((genre) => ({
            genre,
            title,
        })));
        const byGenre = groupBy(pairs, (pair) => pair.genre);
        const ranked = [...byGenre.entries()]
            .map(([genre, list]) => ({
                genre,
                count: list.length,
                films: list.filter((pair) => pair.title.kind === 'movie').length,
                shows: list.filter((pair) => pair.title.kind === 'episode').length,
                share: titles.length ? list.length / titles.length : 0,
                posters: list.slice(-GENRE_POSTERS).map((pair) => history.posterKeyOf(pair.title.event)),
            }))
            .sort((a, b) => b.count - a.count);
        return ranked.slice(0, GENRES_SHOWN);
    }

    // The last watch of each film and of each show.
    private titlesOf(history: UserHistory, events: WatchEvent[]): Array<{ kind: string; event: WatchEvent }> {
        const byTitle = groupBy(events, (event) => history.posterKeyOf(event));
        return [...byTitle.values()].map((list) => {
            const event = list[list.length - 1];
            return {
                kind: event.kind,
                event,
            };
        });
    }

    private moments(history: UserHistory, events: WatchEvent[], user: User): Json[] {
        const moments = [
            this.topShow(history, events),
            this.lateNights(history, events),
            this.sharedWatch(history, events, user),
        ];
        return moments.filter((moment) => moment !== null);
    }

    private topShow(history: UserHistory, events: WatchEvent[]): Json | null {
        const episodes = events.filter((event) => event.kind === 'episode' && event.showKey);
        const byShow = groupBy(episodes, (event) => event.showKey ?? '');
        const top = [...byShow.entries()].sort((a, b) => b[1].length - a[1].length)[0];
        if (!top) {
            return null;
        }
        const [showKey, list] = top;
        const seasons = new Set(list.map((event) => event.seasonKey)).size;
        return {
            label: 'Most-watched show',
            headline: history.item(showKey)?.title ?? 'A show',
            detail: `${list.length} episodes, ${seasons} ${seasons === 1 ? 'season' : 'seasons'}`,
            posterKey: showKey,
        };
    }

    private lateNights(history: UserHistory, events: WatchEvent[]): Json | null {
        const late = events.filter((event) => {
            const hour = history.localStart(event).hour;
            return hour >= 1 && hour < 5;
        });
        const latest = late[late.length - 1];
        if (!latest) {
            return null;
        }
        const when = new Date(history.startOf(latest) * 1000).toLocaleString('en-GB', {
            day: 'numeric',
            month: 'long',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: this.app.settings.timeZone,
        });
        return {
            label: 'Late nights',
            headline: `${late.length} ${late.length === 1 ? 'watch' : 'watches'} after 1am`,
            detail: `Most recent: ${when}`,
            posterKey: history.posterKeyOf(latest),
        };
    }

    // The person who watched the most of the same films within a week.
    private sharedWatch(history: UserHistory, events: WatchEvent[], user: User): Json | null {
        const films = events.filter((event) => event.kind === 'movie');
        const others = this.app.visibleUsers().filter((other) => other.id !== user.id);
        const matches = others.map((other) => ({
            other,
            shared: this.sharedFilms(films, this.app.historyOf(other.id).events),
        }));
        const best = matches.sort((a, b) => b.shared.length - a.shared.length)[0];
        if (!best || !best.shared.length) {
            return null;
        }
        const recent = best.shared[best.shared.length - 1];
        return {
            label: `Shared with ${best.other.name}`,
            headline: `${best.shared.length} ${best.shared.length === 1 ? 'film' : 'films'} within a week`,
            detail: `Most recent: ${history.itemOf(recent)?.title ?? 'a film'}`,
            posterKey: history.posterKeyOf(recent),
        };
    }

    private sharedFilms(films: WatchEvent[], otherEvents: WatchEvent[]): WatchEvent[] {
        const windowSeconds = SHARE_WINDOW_DAYS * 86_400;
        const seen = new Set<string>();
        return films.filter((film) => {
            const isShared = otherEvents.some((other) => {
                const isSame = other.ratingKey === film.ratingKey;
                return isSame && Math.abs(other.watchedAt - film.watchedAt) <= windowSeconds;
            });
            const isNew = !seen.has(film.ratingKey);
            seen.add(film.ratingKey);
            return isShared && isNew;
        });
    }

    private won(userId: string, year: string): Json[] {
        const items = this.app.store.items();
        return this.awardsIn(userId, year).map((award) => ({
            achievementId: award.achievementId,
            awardedAt: award.awardedAt,
            posterKey: award.posterKey,
            posterTitle: items.get(award.posterKey)?.title ?? '',
        }));
    }

    private awardsIn(userId: string, year: string) {
        return this.app.store.awards().filter((award) => {
            const isOwn = award.userId === userId;
            const isKnown = this.app.catalogue.byId(award.achievementId) !== undefined;
            return isOwn && isKnown && this.yearAt(award.awardedAt) === year;
        });
    }

}
