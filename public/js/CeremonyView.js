import {
    awardLink,
    awardsLink,
    escapeHtml,
    formatDay,
    formatNumber,
    progressText,
} from './helpers/index.js';


const RANGES = [
    {
        id: 'all',
        label: 'All time',
        chart: 'All-time standings',
        last: 'End of last month',
    },
    {
        id: 'year',
        label: 'This year',
        chart: 'This year',
        last: 'End of last month',
    },
    {
        id: 'month',
        label: 'This month',
        chart: 'This month',
        last: 'Last month',
    },
];

// The household standings, set like the results sheet of a ceremony:
// this rank, last rank, movement, then the figures.
export class CeremonyView {

    constructor(api, definitions, report) {
        this.api = api;
        this.definitions = definitions;
        this.report = report;
        this.range = RANGES.find((range) => range.id === report.range) ?? RANGES[0];
        this.topPoints = Math.max(1, ...report.people.map((person) => person.points));
    }

    render() {
        const people = this.report.people;
        const summary = `${people.length} people · `
            + `${formatNumber(this.report.totalTrophies)} awards between them · ranked by points`;
        return `<header class="page-head">`
            + `<div class="page-intro">`
            + `<span class="eyebrow">${escapeHtml(summary)}</span>`
            + `<h1 class="page-title">Ceremony</h1>`
            + `<p class="help">${escapeHtml(this.pointsText())}</p>`
            + `</div>`
            + this.rangeLinks()
            + `</header>`
            + `<div class="columns">`
            + `<div class="main-column">${this.standings(people)}</div>`
            + `<aside class="side-column">${this.race()}${this.specialAwards()}</aside>`
            + `</div>`;
    }

    rangeLinks() {
        const links = RANGES.map((range) => {
            const current = range.id === this.range.id ? ' aria-current="true"' : '';
            return `<a class="filter" href="#/ceremony/${range.id}"${current}>${range.label}</a>`;
        });
        return `<nav class="filters" aria-label="Time range">${links.join('')}</nav>`;
    }

    standings(people) {
        const rows = people.map((person) => this.row(person));
        return `<section aria-labelledby="standings">`
            + `<h2 class="section-head" id="standings">${this.range.chart}</h2>`
            + `<div class="table-wrap"><table class="chart standings">`
            + `<thead><tr>`
            + `<th scope="col">Rank</th>`
            + `<th scope="col">Rank last month</th>`
            + `<th scope="col"><span class="visually-hidden">Movement</span></th>`
            + `<th scope="col">Person</th>`
            + `<th scope="col">Points</th>`
            + `<th scope="col" class="number">Awards</th>`
            + `<th scope="col">Last win</th>`
            + `<th scope="col">Rarest award</th>`
            + `</tr></thead>`
            + `<tbody>${rows.join('')}</tbody>`
            + `</table></div>`
            + `<p class="caption scroll-hint">Scroll the table sideways to see more.</p>`
            + `<p class="caption">▲ up, ▼ down, = no change since ${this.range.last.toLowerCase()}.</p>`
            + `</section>`;
    }

    row(person) {
        const rankClass = person.rank === 1 ? 'chart-rank first' : 'chart-rank';
        return `<tr>`
            + `<td><span class="${rankClass}">${person.rank}</span></td>`
            + `<td class="last-rank">${person.lastRank ?? '—'}</td>`
            + `<td>${this.movement(person)}</td>`
            + `<td><a class="chart-name" href="${awardsLink(person.id)}">${escapeHtml(person.name)}</a></td>`
            + `<td>${this.pointsCell(person.points)}</td>`
            + `<td class="number">${formatNumber(person.trophies)}</td>`
            + `<td>${this.lastWinCell(person)}</td>`
            + `<td>${this.rarestCell(person)}</td>`
            + `</tr>`;
    }

    // ▲ 2, ▼ 1, = or NEW.
    movement(person) {
        if (person.lastRank === null) {
            return person.points > 0 ? '<span class="move new">New</span>' : '';
        }
        const change = person.lastRank - person.rank;
        if (change > 0) {
            return `<span class="move up" aria-label="Up ${change}">▲ ${change}</span>`;
        }
        if (change < 0) {
            return `<span class="move down" aria-label="Down ${-change}">▼ ${-change}</span>`;
        }
        return '<span class="move" aria-label="No change">=</span>';
    }

    // One colour. The meter is the share of the leader's points.
    pointsCell(points) {
        const percent = Math.round((points / this.topPoints) * 100);
        return `<span class="points-cell">`
            + `<span class="figure strong">${formatNumber(points)}</span>`
            + `<span class="meter" aria-hidden="true"><span class="meter-fill" style="width: ${percent}%"></span></span>`
            + `</span>`;
    }

    lastWinCell(person) {
        const last = person.lastWin;
        if (!last) {
            return '<span class="caption">None yet</span>';
        }
        const definition = this.definitions.get(last.achievementId);
        return `<a href="${awardLink(last.achievementId, person.id)}">${escapeHtml(definition.title)}</a>`
            + `<br><span class="caption">${escapeHtml(formatDay(last.awardedAt))}</span>`;
    }

    rarestCell(person) {
        const rarest = person.rarest;
        if (!rarest) {
            return '';
        }
        const definition = this.definitions.get(rarest.achievementId);
        const poster = this.api.posterUrl(rarest.posterKey);
        return `<a class="rarest" href="${awardLink(rarest.achievementId, person.id)}">`
            + `<img class="thumb" src="${poster}" alt="" loading="lazy" style="box-shadow: 0 0 0 2px ${definition.colour}">`
            + `<span>${escapeHtml(definition.title)}</span></a>`;
    }

    race() {
        const race = this.report.race;
        if (!race) {
            return '';
        }
        const definition = this.definitions.get(race.achievementId);
        const rows = race.entries.map((entry) => this.raceRow(entry, definition));
        return `<section aria-labelledby="race">`
            + `<h2 class="section-head" id="race">Closest race</h2>`
            + `<p class="caption">${escapeHtml(definition.category)} · ${escapeHtml(definition.title)} · `
            + `${escapeHtml(definition.description)}</p>`
            + rows.join('')
            + `<p class="caption">Everyone who reaches the target wins the award.</p>`
            + `</section>`;
    }

    // "Each award gives points: Official selection 10, …"
    pointsText() {
        const tiers = new Map();
        for (const definition of this.definitions.values()) {
            tiers.set(definition.laurel, definition.points);
        }
        const parts = [...tiers.entries()]
            .sort((a, b) => a[1] - b[1])
            .map(([laurel, points]) => `${laurel} ${points}`);
        return `Each award gives points: ${parts.join(', ')}.`;
    }

    raceRow(entry, definition) {
        const percent = Math.round(Math.min(entry.value / entry.target, 1) * 100);
        return `<div class="household-row">`
            + `<div class="household-head"><span class="row-title">${escapeHtml(entry.name)}</span>`
            + `<span class="figure">${escapeHtml(progressText(entry, definition))}</span></div>`
            + `<div class="meter" role="progressbar" aria-label="${escapeHtml(entry.name)} progress" `
            + `aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">`
            + `<div class="meter-fill" style="width: ${percent}%; background: ${definition.colour}"></div>`
            + `<span class="meter-head" style="left: ${percent}%"></span></div></div>`;
    }

    specialAwards() {
        const rows = this.report.titles.map((title) => {
            return `<li class="side-row"><span class="stack">`
                + `<span class="headline">${escapeHtml(title.title)}</span>`
                + `<span class="caption"><strong>${escapeHtml(title.who)}</strong> · ${escapeHtml(title.value)}</span>`
                + `</span></li>`;
        });
        return `<section aria-labelledby="special">`
            + `<h2 class="section-head" id="special">Household records</h2>`
            + `<p class="caption">Records give no points.</p>`
            + `<ul class="side-list">${rows.join('')}</ul>`
            + `</section>`;
    }

}
