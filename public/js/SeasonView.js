import {
    awardLink,
    escapeHtml,
    formatDay,
    formatNumber,
    seasonLink,
} from './helpers/index.js';

const PAGE_LINE = 'One person\'s year in films, episodes and awards.';
const EMPTY_LINE = 'No watches yet. Watch a film or an episode on Plex. '
    + 'It shows here after the next check.';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// Season review: one person's year. Two small charts, films and
// episodes by month, side by side. Then the top genre, highlights and wins.
export class SeasonView {

    constructor(api, definitions, report) {
        this.api = api;
        this.definitions = definitions;
        this.report = report;
    }

    render() {
        const report = this.report;
        if (!report.year) {
            return `<h1 class="page-title">${escapeHtml(report.user.name)}'s season</h1>`
                + `<p class="empty">${EMPTY_LINE}</p>`;
        }
        return this.header()
            + this.totals()
            + `<div class="chart-pair">`
            + this.chart('Film watches by month', 'film', report.filmMonths)
            + this.chart('Episode watches by month', 'tv', report.tvMonths)
            + `</div>`
            + this.genre()
            + this.moments()
            + this.won();
    }

    header() {
        const report = this.report;
        const today = new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
        });
        const span = report.isCurrentYear ? `1 January to ${today}, so far` : '1 January to 31 December';
        const links = report.years.map((year) => {
            const current = year === report.year ? ' aria-current="true"' : '';
            return `<a class="filter" href="${seasonLink(report.user.id, year)}"${current}>${year}</a>`;
        });
        return `<header class="page-head">`
            + `<div class="page-intro"><span class="eyebrow">${escapeHtml(span)}</span>`
            + `<h1 class="page-title">${escapeHtml(report.user.name)}'s ${report.year} season</h1>`
            + `<p class="help">${PAGE_LINE}</p></div>`
            + `<nav class="filters" aria-label="Year">${links.join('')}</nav>`
            + `</header>`;
    }

    totals() {
        const totals = this.report.totals;
        const entries = [
            ['Film watches', totals.films],
            ['Episode watches', totals.episodes],
            ['Hours watched', totals.hours],
            ['Awards won', totals.trophies],
        ];
        const items = entries.map(([label, value]) => {
            return `<div class="stat"><dt>${label}</dt><dd>${formatNumber(value)}</dd></div>`;
        });
        return `<dl class="stat-row big">${items.join('')}</dl>`;
    }

    // One colour. The busiest months are gold, with their value shown.
    chart(title, id, counts) {
        const total = counts.reduce((sum, value) => sum + value, 0);
        const headId = `months-${id}`;
        if (!total) {
            return `<section class="month-chart" aria-labelledby="${headId}">`
                + `<h2 class="section-head" id="${headId}">${title}</h2>`
                + `<p class="empty">None this year.</p>`
                + `</section>`;
        }
        const peak = Math.max(...counts);
        const bars = counts.map((value, index) => this.bar(value, index, peak));
        const names = MONTHS.map((month) => `<span>${month.slice(0, 1)}</span>`);
        const busiest = this.busiestText(counts, peak);
        const year = this.report.year;
        const summary = `Bar chart: ${title.toLowerCase()} in ${year}. Busiest: ${busiest}.`;
        return `<section class="month-chart" aria-labelledby="${headId}">`
            + `<div class="block-head"><h2 class="section-head" id="${headId}">${title} · ${formatNumber(total)}</h2>`
            + `<span class="caption">Busiest: ${escapeHtml(busiest)}</span></div>`
            + `<div class="bars" role="img" aria-label="${escapeHtml(summary)}">`
            + `<div class="bar-row">${bars.join('')}</div>`
            + `<div class="bar-names" aria-hidden="true">${names.join('')}</div>`
            + `</div>`
            + `</section>`;
    }

    // "February, 3" or "February and June, 3 each".
    busiestText(counts, peak) {
        const months = MONTHS.filter((month, index) => counts[index] === peak);
        if (months.length === 1) {
            return `${months[0]}, ${peak}`;
        }
        const last = months[months.length - 1];
        const head = months.slice(0, -1).join(', ');
        return `${head} and ${last}, ${peak} each`;
    }

    // Every slot keeps room for a label, so equal values draw equal bars.
    bar(value, index, peak) {
        const isPeak = value === peak;
        const height = Math.round((value / peak) * 100);
        const label = isPeak ? String(value) : '';
        const barClass = isPeak ? 'bar peak' : 'bar';
        return `<div class="bar-slot" title="${MONTHS[index]}: ${value}">`
            + `<span class="bar-value">${label}</span>`
            + `<div class="bar-track"><div class="${barClass}" style="height: ${height}%"></div></div>`
            + `</div>`;
    }

    // "Drama · 12 titles: 4 films, 8 shows"
    genre() {
        const [top, ...rest] = this.report.genres;
        if (!top) {
            return '';
        }
        const posters = top.posters.map((key) => `<img src="${this.api.posterUrl(key)}" alt="">`);
        const share = Math.round(top.share * 100);
        const split = `${top.count} titles: ${this.plural(top.films, 'film')}, ${this.plural(top.shows, 'show')}`;
        const then = rest.length
            ? `Then ${rest.map((genre) => `${genre.genre.toLowerCase()} (${genre.count})`).join(' and ')}.`
            : '';
        return `<section class="block" aria-labelledby="genre">`
            + `<h2 class="section-head" id="genre">Top genre</h2>`
            + `<div class="genre"><div class="poster-fan">${posters.join('')}</div>`
            + `<div class="stack"><span class="card-title big">${escapeHtml(top.genre)}</span>`
            + `<span>${escapeHtml(split)}. ${share}% of the titles this year.</span>`
            + `<span class="caption">${escapeHtml(then)}</span></div></div>`
            + `</section>`;
    }

    plural(count, word) {
        return count === 1 ? `1 ${word}` : `${count} ${word}s`;
    }

    moments() {
        const cards = this.report.moments.map((moment) => {
            return `<article class="moment">`
                + `<img class="thumb big" src="${this.api.posterUrl(moment.posterKey)}" alt="">`
                + `<div class="stack"><span class="eyebrow">${escapeHtml(moment.label)}</span>`
                + `<span class="headline">${escapeHtml(moment.headline)}</span>`
                + `<span class="caption">${escapeHtml(moment.detail)}</span></div>`
                + `</article>`;
        });
        if (!cards.length) {
            return '';
        }
        return `<section class="block" aria-labelledby="moments">`
            + `<h2 class="section-head" id="moments">Highlights reel</h2>`
            + `<div class="moments">${cards.join('')}</div>`
            + `</section>`;
    }

    won() {
        const cards = this.report.won.map((award) => this.wonCard(award));
        const body = cards.length
            ? `<div class="grid">${cards.join('')}</div>`
            : `<p class="empty">No awards won in ${this.report.year} yet.</p>`;
        return `<section class="block" aria-labelledby="won">`
            + `<h2 class="section-head" id="won">Awards won in ${this.report.year} · ${cards.length}</h2>`
            + body
            + `</section>`;
    }

    wonCard(award) {
        const definition = this.definitions.get(award.achievementId);
        const poster = this.api.posterUrl(award.posterKey);
        const caption = `${definition.category} · ${formatDay(award.awardedAt)}`;
        return `<a class="card" href="${awardLink(award.achievementId, this.report.user.id)}">`
            + `<div class="poster" style="box-shadow: 0 0 0 2px ${definition.colour}">`
            + `<img src="${poster}" alt="Poster for ${escapeHtml(award.posterTitle)}" loading="lazy">`
            + `<div class="poster-band">`
            + `<span class="band-tier" style="color: ${definition.colour}">${escapeHtml(definition.laurel)}</span>`
            + `<span class="card-title">${escapeHtml(definition.title)}</span></div></div>`
            + `<span class="caption">${escapeHtml(caption)}</span>`
            + `</a>`;
    }

}
