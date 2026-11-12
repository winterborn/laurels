import { FILMS } from './data/films.ts';
import type {
    MockLibrary,
    PlexJson,
} from './MockLibrary.ts';

const DAY_MS = 86_400_000;

// Start times picked for filler watches. Late and early ones feed
// Night owl and Matinee idol.
const FILLER_TIMES = [
    '19:30',
    '20:00',
    '20:30',
    '21:00',
    '21:15',
    '22:00',
    '01:10',
    '10:30',
];

const ALEX = 1;
const SAM = 2;
const JO = 3;
const KIT = 4;
const FRANKIE = 6;
const TESS = 7;

// A made-up household, 2019 to November 2026. Same output every run.
export class MockHistory {

    private readonly library: MockLibrary;
    private readonly rows: PlexJson[] = [];
    private seed = 20261111;

    constructor(library: MockLibrary) {
        this.library = library;
    }

    build(): PlexJson[] {
        this.alex();
        this.sam();
        this.jo();
        this.kit();
        this.frankie();
        this.tess();
        const sorted = this.rows.sort((a, b) => a.viewedAt - b.viewedAt);
        return sorted.map((row, index) => ({
            ...row,
            historyKey: `/status/sessions/history/${index + 1}`,
        }));
    }

    // The film fan: 25th horror film on 2 November 2026.
    private alex(): void {
        this.film(ALEX, 'A Trip to the Moon', '2019-01-06', '20:00');
        const horror = this.titles((film) => film.genres.includes('Horror')).slice(1, 25);
        this.spread(ALEX, horror, '2019-03-02', '2026-10-20', '21:30');
        this.spread(ALEX, this.keatonFilms(), '2020-04-12', '2020-09-30', '20:00');
        this.film(ALEX, 'The General', '2020-04-12', '10:00');
        this.film(ALEX, 'Our Hospitality', '2020-04-12', '12:00');
        this.film(ALEX, 'Sherlock Jr.', '2022-02-05', '20:00');
        this.film(ALEX, 'Sherlock Jr.', '2025-08-30', '20:00');
        this.film(ALEX, 'Charade', '2023-12-27', '18:00');
        this.film(ALEX, 'His Girl Friday', '2023-12-27', '20:15');
        // No film over 3 hours, so the demo can still win Director's cut with one watch.
        const fillerPool = this.titles((film) => !film.genres.includes('Horror') && film.minutes < 180);
        this.filler(ALEX, '2019-01-20', '2026-10-01', 15, fillerPool);
        this.episodes(ALEX, 'The Night Desk', 1, 1, 8, '2026-08-01', '21:00', 1440);
        this.harbourRun();
        this.episodes(ALEX, 'The Night Desk', 2, 1, 6, '2026-10-21', '19:00', 5);
        this.film(ALEX, 'Metropolis', '2026-10-28', '19:30');
        this.film(ALEX, 'Night of the Living Dead', '2026-11-02', '22:05');
    }

    // Harbour Lights, 40 episodes over 25 days, finished 30 October.
    private harbourRun(): void {
        const days = Array.from({ length: 25 }, (_, index) => this.addDays('2026-10-06', index));
        const slots = days.flatMap((day, index) => {
            const isDouble = index % 5 < 3;
            return isDouble ? [`${day} 21:00`, `${day} 21:55`] : [`${day} 21:00`];
        });
        const show = this.library.showByTitle('Harbour Lights');
        slots.slice(0, 40).forEach((slot, index) => {
            const season = Math.floor(index / show.episodesPerSeason) + 1;
            const episode = (index % show.episodesPerSeason) + 1;
            const [day, time] = slot.split(' ');
            this.episode(ALEX, 'Harbour Lights', season, episode, this.epoch(day, time));
        });
    }

    // The TV fan: late nights and box sets.
    private sam(): void {
        this.episodes(SAM, 'Ward 9', 1, 1, 6, '2021-02-13', '22:00', 5);
        this.episodes(SAM, 'Harbour Lights', 1, 1, 10, '2024-07-01', '02:30', 1440);
        this.episodes(SAM, 'Harbour Lights', 2, 1, 10, '2024-08-10', '09:00', 10);
        this.episodes(SAM, 'Harbour Lights', 3, 1, 10, '2024-09-01', '21:00', 1440);
        this.episodes(SAM, 'The Night Desk', 1, 1, 8, '2025-03-01', '21:00', 1440);
        this.episodes(SAM, 'The Night Desk', 2, 1, 8, '2025-05-10', '21:00', 1440);
        this.episodes(SAM, 'Harbour Lights', 4, 1, 8, '2026-11-01', '21:00', 1440);
        this.filler(SAM, '2020-06-01', '2026-10-15', 30, this.titles(() => true));
    }

    // The comedy fan, since 2023.
    private jo(): void {
        const comedies = this.titles((film) => film.genres.includes('Comedy'))
            .filter((title) => title !== 'Go West' && title !== 'Battling Butler')
            .slice(0, 18);
        this.spread(JO, comedies, '2023-01-14', '2026-10-25', '20:00');
        this.episodes(JO, 'Ward 9', 1, 1, 1, '2024-05-04', '20:30', 5);
        this.filler(JO, '2023-02-01', '2026-10-01', 45, this.titles((film) => !film.genres.includes('Comedy')));
    }

    // New on the server: three days of watching.
    private kit(): void {
        this.film(KIT, 'A Trip to the Moon', '2026-10-30', '20:00');
        this.episodes(KIT, 'Ward 9', 1, 1, 2, '2026-11-01', '20:00', 5);
        this.film(KIT, 'Sherlock Jr.', '2026-11-05', '19:00');
    }

    // Films only, never an episode. Tests that TV-free pages look complete.
    private frankie(): void {
        this.filler(FRANKIE, '2024-01-06', '2026-11-01', 9, this.titles(() => true));
    }

    // Television only, never a film. Tests that film-free pages look complete.
    private tess(): void {
        this.episodes(TESS, 'Ward 9', 1, 1, 6, '2025-01-04', '20:30', 5);
        this.episodes(TESS, 'The Night Desk', 1, 1, 8, '2025-02-01', '21:00', 1440);
        this.episodes(TESS, 'The Night Desk', 2, 1, 8, '2025-03-01', '20:15', 1440);
        this.episodes(TESS, 'Harbour Lights', 1, 1, 10, '2025-06-07', '10:00', 10);
        this.episodes(TESS, 'Harbour Lights', 2, 1, 10, '2025-09-01', '20:30', 1440);
        this.episodes(TESS, 'Harbour Lights', 3, 1, 10, '2026-01-10', '01:30', 1440);
        this.episodes(TESS, 'Harbour Lights', 4, 1, 6, '2026-10-20', '21:00', 1440);
    }

    private keatonFilms(): string[] {
        return this.titles((film) => film.actors.includes('Buster Keaton'));
    }

    private titles(keep: (film: (typeof FILMS)[number]) => boolean): string[] {
        return FILMS.filter(keep).map((film) => film.title);
    }

    // One film from the list every few days, in list order.
    private spread(
        userId: number,
        titles: string[],
        from: string,
        to: string,
        time: string,
    ): void {
        const span = this.daysBetween(from, to);
        titles.forEach((title, index) => {
            const offset = Math.floor((span * index) / Math.max(titles.length - 1, 1));
            this.film(userId, title, this.addDays(from, offset), time);
        });
    }

    // Random films about every `gap` days.
    private filler(
        userId: number,
        from: string,
        to: string,
        gap: number,
        pool: string[],
    ): void {
        const count = Math.floor(this.daysBetween(from, to) / gap);
        for (const index of Array.from({ length: count }, (_, step) => step)) {
            const jitter = Math.floor(this.random() * gap);
            const day = this.addDays(from, index * gap + jitter);
            const title = pool[Math.floor(this.random() * pool.length)];
            const time = FILLER_TIMES[Math.floor(this.random() * FILLER_TIMES.length)];
            this.film(userId, title, day, time);
        }
    }

    private film(userId: number, title: string, day: string, time: string): void {
        const ratingKey = this.library.filmKey(title);
        const item = this.library.get(ratingKey) ?? {};
        const start = this.epoch(day, time);
        this.rows.push({
            ratingKey,
            key: `/library/metadata/${ratingKey}`,
            title,
            type: 'movie',
            thumb: item.thumb,
            viewedAt: start + item.duration / 1000,
            accountID: userId,
            deviceID: 1,
        });
    }

    // Consecutive episodes, `gapMinutes` after each one ends (1440 = next day).
    private episodes(
        userId: number,
        showTitle: string,
        season: number,
        from: number,
        to: number,
        day: string,
        time: string,
        gapMinutes: number,
    ): void {
        const show = this.library.showByTitle(showTitle);
        const isDaily = gapMinutes === 1440;
        const step = isDaily ? DAY_MS / 1000 : (show.minutes + gapMinutes) * 60;
        const first = this.epoch(day, time);
        for (const episode of Array.from({ length: to - from + 1 }, (_, index) => from + index)) {
            const start = first + (episode - from) * step;
            this.episode(userId, showTitle, season, episode, start);
        }
    }

    private episode(
        userId: number,
        showTitle: string,
        season: number,
        episode: number,
        start: number,
    ): void {
        const show = this.library.showByTitle(showTitle);
        const showKey = show.ratingKey;
        const seasonKey = showKey + 10 * season;
        const ratingKey = String(showKey + 100 * season + episode);
        this.rows.push({
            ratingKey,
            key: `/library/metadata/${ratingKey}`,
            parentKey: `/library/metadata/${seasonKey}`,
            grandparentKey: `/library/metadata/${showKey}`,
            title: `Chapter ${episode}`,
            grandparentTitle: showTitle,
            type: 'episode',
            index: episode,
            parentIndex: season,
            thumb: `/library/metadata/${showKey}/thumb/1`,
            viewedAt: start + show.minutes * 60,
            accountID: userId,
            deviceID: 2,
        });
    }

    // Local London time to epoch seconds.
    private epoch(day: string, time: string): number {
        const guess = Date.parse(`${day}T${time}:00Z`);
        const londonHour = Number(new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London',
            hour: '2-digit',
            hourCycle: 'h23',
        }).format(guess));
        const utcHour = new Date(guess).getUTCHours();
        const offsetHours = (londonHour - utcHour + 24) % 24;
        return Math.round((guess - offsetHours * 3_600_000) / 1000);
    }

    private addDays(day: string, days: number): string {
        const date = new Date(Date.parse(`${day}T12:00:00Z`) + days * DAY_MS);
        return date.toISOString().slice(0, 10);
    }

    private daysBetween(from: string, to: string): number {
        const span = Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`);
        return Math.round(span / DAY_MS);
    }

    // Mulberry32: small, seeded, repeatable.
    private random(): number {
        this.seed = (this.seed + 0x6d2b79f5) | 0;
        const mixed = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
        const shuffled = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
        return ((shuffled ^ (shuffled >>> 14)) >>> 0) / 4_294_967_296;
    }

}
