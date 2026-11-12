import {
    awardLink,
    ballotLink,
    CATEGORIES,
    escapeHtml,
    formatClock,
    formatDay,
    formatNumber,
    initialOf,
    laurelLabel,
    ordinal,
    progressText,
    shareOf,
    yearOf,
} from './helpers/index.js';
import { Laurel } from './Laurel.js';

const SHELF_SIZE = 6;
const NOMINATIONS_EACH = 2;

// One person's Awards page: the Winner (the newest award), a Film shelf
// and a Television shelf side by side, a Screen row, then Nominations.
// The full list of awards lives on the Ballot only.
export class AwardsView {

    constructor(api, definitions, cabinet, user) {
        this.api = api;
        this.definitions = definitions;
        this.cabinet = cabinet;
        this.user = user;
    }

    render() {
        return [
            this.header(),
            this.winner(),
            this.shelves(),
            this.shelf(CATEGORIES[2], 'shelf wide'),
            this.nominations(),
        ].join('');
    }

    // Header: name, then one row of figures.

    header() {
        const user = this.user;
        const since = user.since ? `Watching since ${yearOf(user.since)}` : 'No watches yet';
        return `<header class="profile">`
            + `<span class="avatar" aria-hidden="true">${escapeHtml(initialOf(user.name))}</span>`
            + `<div class="page-intro">`
            + `<span class="eyebrow">${escapeHtml(since)}</span>`
            + `<h1 class="page-title">${escapeHtml(user.name)}'s awards</h1>`
            + `</div></header>`
            + this.stats();
    }

    stats() {
        const user = this.user;
        const stats = [
            ['Awards', `${user.trophies} of ${this.definitions.size}`],
            ['Points', formatNumber(user.points)],
            ['Rank', ordinal(user.rank)],
            ['Films', formatNumber(user.films)],
            ['Episodes', formatNumber(user.episodes)],
        ];
        const items = stats.map(([label, value]) => {
            return `<div class="stat"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`;
        });
        return `<dl class="stat-row">${items.join('')}</dl>`;
    }

    // Winner: the newest award, widescreen.

    winner() {
        const latest = this.cabinet.awards[0];
        if (!latest) {
            return '<p class="empty">No awards yet. Watch a film or an episode on Plex to win the first one.</p>';
        }
        const definition = this.definitions.get(latest.achievementId);
        const poster = this.api.posterUrl(latest.posterKey);
        const label = [
            'Winner',
            definition.category,
            formatDay(latest.awardedAt),
            formatClock(latest.awardedAt),
        ].join(' · ');
        return `<section class="winner" aria-labelledby="winner-title">`
            + `<div class="screen">`
            + `<div class="screen-picture">`
            + this.stillImage(latest, poster)
            + `<div class="screen-tint"></div></div>`
            + `<span class="screen-label left">${escapeHtml(label.toUpperCase())}</span>`
            + `<span class="screen-label right">2.39 : 1</span>`
            + `<span class="screen-quote">${escapeHtml(definition.flavorText)}</span>`
            + `</div>`
            + this.feature(latest, definition, poster)
            + `</section>`;
    }

    // The backdrop when the server has one, else the poster cropped to its top.
    stillImage(award, poster) {
        if (!award.hasArt) {
            return `<img src="${poster}" class="is-fallback" alt="">`;
        }
        return `<img src="${this.api.artUrl(award.posterKey)}" data-fallback="${poster}" alt="">`;
    }

    feature(award, definition, poster) {
        const ring = `box-shadow: 0 0 0 4px ${definition.colour}, var(--raised)`;
        const tier = `${definition.laurel} · ${definition.points} points`;
        const link = awardLink(award.achievementId, this.user.id);
        return `<div class="feature">`
            + `<div class="feature-poster" style="${ring}">`
            + `<img src="${poster}" alt="Poster for ${escapeHtml(award.posterTitle)}"></div>`
            + `<div class="feature-text">`
            + `<h2 class="display" id="winner-title"><a href="${link}">${escapeHtml(definition.title)}</a></h2>`
            + `<div class="feature-line">`
            + Laurel.html(definition.colour, definition.tier, 'big', escapeHtml(laurelLabel(definition)))
            + `<span class="eyebrow" style="color: ${definition.colour}">${escapeHtml(tier)}</span>`
            + `<span>${escapeHtml(this.wonLine(award, definition))}</span>`
            + `</div></div></div>`;
    }

    wonLine(award, definition) {
        if (!award.posterTitle) {
            return definition.description;
        }
        return `${definition.description} Won with ${award.posterTitle}.`;
    }

    // Shelves: Film and Television side by side, equal width.
    // On a phone the one this person watches more comes first.

    shelves() {
        const tvFirst = this.user.episodes > this.user.films;
        const pairClass = tvFirst ? 'shelf-pair tv-first' : 'shelf-pair';
        return `<div class="${pairClass}">`
            + this.shelf(CATEGORIES[0], 'shelf film')
            + this.shelf(CATEGORIES[1], 'shelf tv')
            + `</div>`;
    }

    shelf(category, className) {
        const all = this.awardsIn(category.id);
        const total = this.definitionsIn(category.id).length;
        const shown = all.slice(0, SHELF_SIZE);
        const headId = `shelf-${category.id}`;
        const body = shown.length
            ? `<div class="shelf-grid">${shown.map((award) => this.card(award)).join('')}</div>`
            : this.emptyShelf(category);
        return `<section class="${className}" aria-labelledby="${headId}">`
            + `<div class="shelf-head">`
            + `<h2 class="shelf-title" id="${headId}">${category.name} · ${all.length} of ${total}</h2>`
            + `<a class="more" href="${ballotLink(this.user.id)}">All ${total} on the Ballot</a>`
            + `</div>`
            + body
            + `</section>`;
    }

    // An empty shelf names the nearest award in its category.
    emptyShelf(category) {
        const nearest = this.nearestIn(category.id, 1)[0];
        const name = category.name.toLowerCase();
        if (!nearest) {
            return `<p class="empty">No ${name} awards yet.</p>`;
        }
        const definition = this.definitions.get(nearest.achievementId);
        const text = `No ${name} awards yet. ${this.nearestText(nearest, definition)}`;
        return `<p class="empty">${escapeHtml(text)}</p>`;
    }

    // "Nearest: Couch potato, 10 of 12." or "The first is Fade in. Your first film."
    nearestText(progress, definition) {
        if (progress.value > 0) {
            return `Nearest: ${definition.title}, ${progressText(progress, definition)}.`;
        }
        return `The first is ${definition.title}. ${definition.description}`;
    }

    card(award) {
        const definition = this.definitions.get(award.achievementId);
        const tag = this.tagFor(award, definition);
        const tagHtml = tag ? `<span class="poster-tag">${escapeHtml(tag)}</span>` : '';
        const caption = `${this.captionFor(award, definition)} · ${formatDay(award.awardedAt)}`;
        const poster = this.api.posterUrl(award.posterKey);
        return `<a class="card" href="${awardLink(award.achievementId, this.user.id)}">`
            + `<div class="poster" style="box-shadow: 0 0 0 2px ${definition.colour}">`
            + `<img src="${poster}" alt="Poster for ${escapeHtml(award.posterTitle)}" loading="lazy">`
            + Laurel.html(definition.colour, definition.tier, 'small', escapeHtml(laurelLabel(definition)))
            + tagHtml
            + `<div class="poster-band">`
            + `<span class="band-tier" style="color: ${definition.colour}">${escapeHtml(definition.laurel)}</span>`
            + `<span class="card-title">${escapeHtml(definition.title)}</span>`
            + `</div></div>`
            + `<span class="caption">${escapeHtml(caption)}</span>`
            + `</a>`;
    }

    // Season and show awards get a corner tag, for example "Season 4".
    tagFor(award, definition) {
        if (definition.ruleType !== 'complete') {
            return '';
        }
        const season = award.note.match(/season (\d+)$/);
        if (season) {
            return `Season ${season[1]}`;
        }
        return 'Whole show';
    }

    // Director and actor awards name the person. Others name the title.
    captionFor(award, definition) {
        const namesPerson = definition.ruleType === 'count' && award.note;
        if (namesPerson) {
            return award.note;
        }
        return award.posterTitle || definition.title;
    }

    // Nominations: the 2 awards nearest to a win in each category.

    nominations() {
        const columns = CATEGORIES.map((category) => {
            const nearest = this.nearestIn(category.id, NOMINATIONS_EACH);
            return nearest.filter((progress) => progress.value > 0);
        });
        const hasAny = columns.some((column) => column.length);
        if (!hasAny) {
            return '';
        }
        const notYet = this.cabinet.progress.filter((progress) => !progress.earned).length;
        return `<section class="block" aria-labelledby="nominations">`
            + `<div class="block-head">`
            + `<h2 class="section-head" id="nominations">Nominations · nearest to a win</h2>`
            + `<a class="more" href="${ballotLink(this.user.id)}">All ${notYet} not yet won</a>`
            + `</div>`
            + `<div class="nominations">${columns.map((column) => this.nominationColumn(column)).join('')}</div>`
            + `</section>`;
    }

    // One column for each category, so Film, Television and Screen line up.
    nominationColumn(column) {
        const cards = column.map((progress) => this.nomination(progress));
        return `<div class="nomination-column">${cards.join('')}</div>`;
    }

    nomination(progress) {
        const definition = this.definitions.get(progress.achievementId);
        const percent = Math.round(shareOf(progress) * 100);
        const link = awardLink(progress.achievementId, this.user.id);
        return `<a class="nomination" href="${link}">`
            + `<span class="eyebrow">Nominated · ${escapeHtml(definition.category)}</span>`
            + `<span class="card-title">${escapeHtml(definition.title)}</span>`
            + `<span class="caption">${escapeHtml(definition.description)}</span>`
            + this.meter(definition, percent)
            + `<span class="figure">${escapeHtml(progressText(progress, definition))}</span>`
            + `</a>`;
    }

    meter(definition, percent) {
        return `<div class="meter" role="progressbar" aria-label="${escapeHtml(definition.title)} progress" `
            + `aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">`
            + `<div class="meter-fill" style="width: ${percent}%; background: ${definition.colour}"></div>`
            + `</div>`;
    }

    // Lookups

    awardsIn(section) {
        return this.cabinet.awards.filter((award) => {
            return this.definitions.get(award.achievementId).section === section;
        });
    }

    definitionsIn(section) {
        return [...this.definitions.values()].filter((definition) => definition.section === section);
    }

    // Not won and not secret: the nearest first.
    nearestIn(section, count) {
        return this.cabinet.progress
            .filter((progress) => !progress.earned)
            .filter((progress) => {
                const definition = this.definitions.get(progress.achievementId);
                return definition.section === section && !definition.secret;
            })
            .sort((a, b) => shareOf(b) - shareOf(a))
            .slice(0, count);
    }

}
