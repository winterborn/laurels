import {
    awardLink,
    escapeHtml,
    formatDay,
} from './helpers/index.js';
import { Laurel } from './Laurel.js';

const LIMIT = 60;
const DAY_MS = 86_400_000;

// Press room: every award in the household, newest first,
// grouped by week like the announcements of a festival.
// A new award pack shows in the week that it arrived.
export class PressRoomView {

    constructor(api, definitions, awards, packs = []) {
        this.api = api;
        this.definitions = definitions;
        this.awards = awards.slice(0, LIMIT);
        this.packs = this.packsInRange(packs, awards.length > LIMIT);
    }

    // Packs that arrived after the oldest award on the page. A pack from the start has no news.
    packsInRange(packs, isCut) {
        const oldest = isCut ? this.awards[this.awards.length - 1].awardedAt : 0;
        return packs.filter((pack) => pack.arrivedAt && pack.arrivedAt >= oldest);
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
        for (const entry of this.entries()) {
            const label = this.weekEnding(entry.at);
            const list = weeks.get(label) ?? [];
            list.push(entry);
            weeks.set(label, list);
        }
        return weeks;
    }

    // Awards and packs, newest first.
    entries() {
        const awards = this.awards.map((award) => ({
            at: award.awardedAt,
            award,
        }));
        const packs = this.packs.map((pack) => ({
            at: pack.arrivedAt,
            pack,
        }));
        return [...awards, ...packs].sort((a, b) => b.at - a.at);
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

    week(label, entries) {
        const rows = entries.map((entry) => entry.pack ? this.packRow(entry.pack) : this.row(entry.award));
        return `<section class="press-week">`
            + `<h2 class="section-head">${escapeHtml(label)} · ${this.countOf(entries)}</h2>`
            + `<ol class="side-list">${rows.join('')}</ol>`
            + `</section>`;
    }

    // "7 awards", "1 award pack", or "7 awards · 1 award pack".
    countOf(entries) {
        const awards = entries.filter((entry) => entry.award).length;
        const packs = entries.length - awards;
        const parts = [
            this.plural(awards, 'award'),
            this.plural(packs, 'award pack'),
        ];
        return parts.filter(Boolean).join(' · ');
    }

    plural(count, word) {
        if (!count) {
            return '';
        }
        return count === 1 ? `1 ${word}` : `${count} ${word}s`;
    }

    // "New award pack: Long nights", with its awards on the Ballot.
    packRow(pack) {
        const detail = [
            formatDay(pack.arrivedAt),
            this.plural(pack.awards, 'new award'),
            pack.description,
        ].filter(Boolean).join(' · ');
        return `<li><a class="side-row plain" href="#/ballot">`
            + `<span class="thumb pack-thumb">${Laurel.svg('currentColor', 'Legendary')}</span>`
            + `<span class="stack"><span class="headline">New award pack: ${escapeHtml(pack.name)}</span>`
            + `<span class="caption">${escapeHtml(detail)}</span></span>`
            + `</a></li>`;
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
