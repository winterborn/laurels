import {
    awardLink,
    CATEGORIES,
    escapeHtml,
    formatDay,
    formatNumber,
    joinNames,
    laurelLabel,
    progressText,
    SECRET_RULE,
} from './helpers/index.js';
import { Laurel } from './Laurel.js';

const SHOWS = [
    {
        id: 'all',
        label: 'All',
    },
    {
        id: 'won',
        label: 'Won',
    },
    {
        id: 'open',
        label: 'Not yet',
    },
];

// Every award on one paper ballot, in three columns:
// Best in Film, Best in Television, Best on Screen.
// A won award gets a mark in its box.
export class BallotView {

    constructor(api, definitions, cabinet, users) {
        this.api = api;
        this.definitions = definitions;
        this.cabinet = cabinet;
        this.names = new Map(users.map((user) => [user.id, user.name]));
        this.awards = new Map(cabinet.awards.map((award) => [award.achievementId, award]));
        this.progress = new Map(cabinet.progress.map((entry) => [entry.achievementId, entry]));
        this.show = 'all';
        this.root = null;
    }

    // Renders into a new element each time, so old listeners go with it.
    mount(page) {
        const root = document.createElement('div');
        root.className = 'view';
        page.replaceChildren(root);
        this.root = root;
        root.addEventListener('click', (event) => this.onClick(event));
        this.paint();
    }

    paint() {
        this.root.innerHTML = this.header()
            + `<section class="ballot" aria-label="Ballot">`
            + this.paperHead()
            + `<div class="ballot-columns">${CATEGORIES.map((category) => this.column(category)).join('')}</div>`
            + `</section>`;
    }

    onClick(event) {
        const button = event.target.closest('[data-show]');
        if (!button) {
            return;
        }
        this.show = button.dataset.show;
        this.paint();
    }

    // Header

    header() {
        const user = this.cabinet.user;
        const all = [...this.definitions.values()];
        const won = all.filter((definition) => this.awards.has(definition.id));
        const points = won.reduce((sum, definition) => sum + definition.points, 0);
        const maxPoints = all.reduce((sum, definition) => sum + definition.points, 0);
        const summary = `${won.length} of ${all.length} won · `
            + `${formatNumber(points)} of ${formatNumber(maxPoints)} points`;
        const name = escapeHtml(user.name);
        const markLine = `Every award and its rule. A cross marks each award that ${name} won.`;
        const timeLine = 'Rewatches count. Times and days use the time zone that the owner set in Settings.';
        return `<header class="page-head">`
            + `<div class="page-intro">`
            + `<span class="eyebrow">${escapeHtml(summary)}</span>`
            + `<h1 class="page-title">${name}'s ballot</h1>`
            + `<p class="help">${markLine}</p>`
            + `<p class="help">${timeLine}</p>`
            + `</div>`
            + this.filters()
            + `</header>`;
    }

    filters() {
        const buttons = SHOWS.map((show) => {
            const pressed = show.id === this.show;
            const count = this.countFor(show.id);
            return `<button type="button" class="filter" data-show="${show.id}" `
                + `aria-pressed="${pressed}">${show.label} ${count}</button>`;
        });
        return `<div class="filters" role="group" aria-label="Show">${buttons.join('')}</div>`;
    }

    // "All 118", "Won 39", "Not yet 79".
    countFor(showId) {
        const all = [...this.definitions.values()];
        return this.filtered(all, showId).length;
    }

    paperHead() {
        const won = this.awards.size;
        const name = escapeHtml(this.cabinet.user.name);
        return `<div class="ballot-head">`
            + `<h2 class="ballot-title">The Ballot · All time</h2>`
            + `<span class="ballot-figure">${name} · ${won} won</span>`
            + `</div>`;
    }

    // Columns

    column(category) {
        const definitions = [...this.definitions.values()]
            .filter((definition) => definition.section === category.id);
        const won = definitions.filter((definition) => this.awards.has(definition.id)).length;
        const rows = this.filtered(definitions).map((definition) => this.row(definition));
        const body = rows.length
            ? `<ol class="ballot-list">${rows.join('')}</ol>`
            : `<p class="ballot-empty">${escapeHtml(this.emptyText())}</p>`;
        return `<section class="ballot-column" aria-label="${category.ballot}">`
            + `<h3 class="ballot-category">${category.ballot} · ${won} of ${definitions.length}</h3>`
            + body
            + `</section>`;
    }

    // A column with no rows says why.
    emptyText() {
        switch (this.show) {
            case 'won':
                return 'No won awards here yet.';
            default:
                return `${this.cabinet.user.name} won every award here.`;
        }
    }

    filtered(definitions, show = this.show) {
        switch (show) {
            case 'won':
                return definitions.filter((definition) => this.awards.has(definition.id));
            case 'open':
                return definitions.filter((definition) => !this.awards.has(definition.id));
            default:
                return definitions;
        }
    }

    row(definition) {
        const award = this.awards.get(definition.id);
        const isHidden = definition.secret && !award;
        const title = isHidden ? 'Secret award' : definition.title;
        const rule = isHidden ? SECRET_RULE : definition.description;
        const rowClass = award ? 'ballot-row won' : 'ballot-row';
        const mark = award ? '✕' : '';
        const link = awardLink(definition.id, this.cabinet.user.id);
        return `<li><a class="${rowClass}" href="${link}">`
            + `<span class="ballot-box" aria-hidden="true">${mark}</span>`
            + `<span class="ballot-text">`
            + `<span class="ballot-name">${escapeHtml(title)}</span>`
            + `<span class="ballot-rule">${escapeHtml(rule)}</span>`
            + `<span class="ballot-note">${escapeHtml(this.noteFor(definition, award, isHidden))}</span>`
            + `</span>`
            + Laurel.html(definition.colour, definition.tier, 'tile', escapeHtml(laurelLabel(definition)))
            + `</a></li>`;
    }

    // "Won 8 Mar 2025 · Won by Alex and Sam", or "8 of 10 · No one yet".
    noteFor(definition, award, isHidden) {
        const status = this.statusFor(definition, award, isHidden);
        return `${status} · ${this.holdersFor(definition)}`;
    }

    statusFor(definition, award, isHidden) {
        if (award) {
            return `Won ${formatDay(award.awardedAt)}`;
        }
        const progress = this.progress.get(definition.id);
        if (isHidden || !progress) {
            return 'Not yet';
        }
        return progressText(progress, definition);
    }

    holdersFor(definition) {
        const names = definition.holderIds
            .map((id) => this.names.get(id))
            .filter(Boolean);
        if (!names.length) {
            return 'No one yet';
        }
        return `Won by ${joinNames(names)}`;
    }

}
