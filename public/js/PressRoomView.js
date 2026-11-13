import {
    awardLink,
    escapeHtml,
    formatDay,
} from './helpers/index.js';

const LIMIT = 60;
const DAY_MS = 86_400_000;

// Press room: every award in the household, newest first,
// grouped by week like the announcements of a festival.
export class PressRoomView {

    constructor(api, definitions, awards) {
        this.api = api;
        this.definitions = definitions;
        this.awards = awards.slice(0, LIMIT);
    }

    render() {
        const weeks = this.byWeek();
        const sections = [...weeks.entries()].map(([label, awards]) => this.week(label, awards));
        return `<header class="page-head"><div class="page-intro">`
            + `<span class="eyebrow">The latest ${this.awards.length} awards in the household</span>`
            + `<h1 class="page-title">Press room</h1>`
            + `<p class="help">Every new award in the household, newest week first.</p>`
            + `</div></header>`
            + this.body(sections);
    }

    body(sections) {
        if (!sections.length) {
            return '<p class="empty">No awards yet. Watch a film or an episode on Plex to win the first one.</p>';
        }
        return `<div class="press-weeks">${sections.join('')}</div>`;
    }

    // Map keeps insertion order, so the newest week comes first.
    byWeek() {
        const weeks = new Map();
        for (const award of this.awards) {
            const label = this.weekEnding(award.awardedAt);
            const list = weeks.get(label) ?? [];
            list.push(award);
            weeks.set(label, list);
        }
        return weeks;
    }

    // "Week ending Sunday 2 November 2026"
    weekEnding(epochSeconds) {
        const date = new Date(epochSeconds * 1000);
        const daysToSunday = (7 - date.getDay()) % 7;
        const sunday = new Date(date.getTime() + daysToSunday * DAY_MS);
        const text = sunday.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        return `Week ending ${text}`;
    }

    week(label, awards) {
        const rows = awards.map((award) => this.row(award));
        const count = awards.length === 1 ? '1 award' : `${awards.length} awards`;
        return `<section class="press-week">`
            + `<h2 class="section-head">${escapeHtml(label)} · ${count}</h2>`
            + `<ol class="side-list">${rows.join('')}</ol>`
            + `</section>`;
    }

    // "Sam wins Couch potato (Television)"
    row(award) {
        const definition = this.definitions.get(award.achievementId);
        const headline = `${award.userName} wins ${definition.title} (${definition.category})`;
        const detail = [
            formatDay(award.awardedAt),
            award.posterTitle,
            `${definition.laurel} · ${definition.points} points`,
        ].filter(Boolean).join(' · ');
        const poster = this.api.posterUrl(award.posterKey);
        return `<li><a class="side-row plain" href="${awardLink(award.achievementId, award.userId)}">`
            + `<img class="thumb" src="${poster}" alt="" loading="lazy" style="box-shadow: 0 0 0 2px ${definition.colour}">`
            + `<span class="stack"><span class="headline">${escapeHtml(headline)}</span>`
            + `<span class="caption">${escapeHtml(detail)}</span></span>`
            + `</a></li>`;
    }

}
