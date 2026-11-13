import {
    awardLink,
    awardsLink,
    escapeHtml,
    formatDay,
    initialOf,
    laurelLabel,
    progressText,
    SECRET_RULE,
    slateHtml,
} from './helpers/index.js';
import { Laurel } from './Laurel.js';

// One award for one person: the poster, the facts, the credits and the household.
export class AwardView {

    constructor(api, definitions, report) {
        this.api = api;
        this.definitions = definitions;
        this.report = report;
        this.definition = definitions.get(report.achievementId);
    }

    get isHidden() {
        return this.definition.secret && !this.report.award;
    }

    // The tab title. A secret award keeps its name out of it.
    get pageTitle() {
        if (!this.definition) {
            return 'Award';
        }
        return this.isHidden ? 'Secret award' : this.definition.title;
    }

    render() {
        const user = this.report.user;
        const title = this.pageTitle;
        return `<p class="crumbs"><a href="${awardsLink(user.id)}">${escapeHtml(user.name)}'s awards</a>`
            + ` / ${escapeHtml(title)}</p>`
            + this.hero(title)
            + `<div class="columns">`
            + `<div class="main-column">${this.credits()}</div>`
            + `<aside class="side-column">${this.household()}${this.related()}</aside>`
            + `</div>`;
    }

    hero(title) {
        const definition = this.definition;
        const eyebrow = [
            definition.category,
            definition.laurel,
            `${definition.points} points`,
        ].join(' · ');
        const rule = this.isHidden ? SECRET_RULE : definition.description;
        const hasCitation = !this.isHidden && definition.flavorText;
        const citation = hasCitation ? `<p class="citation">${escapeHtml(definition.flavorText)}</p>` : '';
        return `<section class="detail" aria-labelledby="award-title">`
            + this.poster(title)
            + `<div class="detail-text">`
            + `<span class="eyebrow" style="color: ${definition.colour}">${escapeHtml(eyebrow)}</span>`
            + `<h1 id="award-title" class="display">${escapeHtml(title)}</h1>`
            + `<p class="detail-rule">${escapeHtml(rule)}</p>`
            + this.spoiler()
            + citation
            + this.facts()
            + `<p class="caption">${escapeHtml(this.wonSentence())}</p>`
            + `</div></section>`;
    }

    // A secret award stays closed until the person chooses to read it.
    spoiler() {
        if (!this.isHidden) {
            return '';
        }
        const definition = this.definition;
        return `<details class="spoiler">`
            + `<summary>Show the secret</summary>`
            + `<p class="spoiler-title">${escapeHtml(definition.title)}</p>`
            + `<p class="detail-rule">${escapeHtml(definition.description)}</p>`
            + `</details>`;
    }

    poster(title) {
        const award = this.report.award;
        const definition = this.definition;
        const posterKey = award?.posterKey ?? this.report.progress?.posterKey;
        const ring = award ? `box-shadow: 0 0 0 4px ${definition.colour}` : 'box-shadow: 0 0 0 1px var(--avatar)';
        const hasImage = Boolean(posterKey) && !this.isHidden;
        const image = hasImage
            ? `<img src="${this.api.posterUrl(posterKey)}" alt="" class="${award ? '' : 'dimmed'}">`
            : this.slate(title);
        const sash = award || !hasImage ? '' : '<span class="sash">NOMINATED</span>';
        return `<div class="detail-poster poster" style="${ring}">${image}${sash}`
            + Laurel.html(definition.colour, definition.tier, 'small', escapeHtml(laurelLabel(definition)))
            + `<div class="poster-band"><span class="card-title">${escapeHtml(title)}</span></div>`
            + `</div>`;
    }

    slate(title) {
        const progress = this.report.progress;
        const scene = this.isHidden || !progress
            ? 'Secret'
            : progressText(progress, this.definition);
        return slateHtml([
            ['Award', title],
            ['Progress', scene],
            ['Tier', this.definition.laurel],
        ]);
    }

    facts() {
        const household = this.report.household;
        const holders = household.filter((person) => person.earned).length;
        const facts = [
            ['Category', this.definition.category],
            ['Points', String(this.definition.points)],
            ['Household', `${holders} of ${household.length} won it`],
            this.lastFact(),
        ];
        const rows = facts.map(([label, value]) => {
            return `<div class="stat"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
        });
        return `<dl class="stat-row">${rows.join('')}</dl>`;
    }

    // The full date is in the sentence below, so the fact names the title.
    lastFact() {
        const award = this.report.award;
        const progress = this.report.progress;
        if (this.isHidden) {
            return ['Progress', 'Secret'];
        }
        if (award) {
            return ['Won with', award.earnedWith || formatDay(award.awardedAt)];
        }
        if (progress) {
            return ['Progress', progressText(progress, this.definition)];
        }
        return ['Progress', 'Not started'];
    }

    wonSentence() {
        const award = this.report.award;
        const name = this.report.user.name;
        if (!award) {
            return `${name} has not won this award yet.`;
        }
        const date = new Date(award.awardedAt * 1000);
        const when = date.toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        if (!award.earnedWith) {
            return `Won on ${when}.`;
        }
        return `Won on ${when}, when ${name} finished ${award.earnedWith}.`;
    }

    credits() {
        const rows = this.report.credits.map((credit, index) => this.creditRow(credit, index));
        const count = this.report.creditCount;
        const shown = rows.length < count ? ` · newest ${rows.length}` : '';
        const watches = count === 1 ? 'matching watch' : 'matching watches';
        const body = this.isHidden || !rows.length
            ? '<p class="empty">No watches count toward this award yet.</p>'
            : `<ol class="credit-list">${rows.join('')}</ol>`;
        return `<section aria-labelledby="credits">`
            + `<h2 class="section-head" id="credits">The credits · ${count} ${watches}${shown}</h2>`
            + `<p class="help">The watches that match the rule of this award.</p>`
            + body
            + `</section>`;
    }

    creditRow(credit, index) {
        const isLast = index === 0 && Boolean(this.report.award);
        const numberClass = isLast ? 'credit-number first' : 'credit-number';
        return `<li class="credit">`
            + `<span class="${numberClass}">${credit.number}</span>`
            + `<img class="thumb" src="${this.api.posterUrl(credit.posterKey)}" alt="" loading="lazy">`
            + `<span class="credit-title">${escapeHtml(credit.title)}</span>`
            + `<span class="caption">${escapeHtml(formatDay(credit.watchedAt))}</span>`
            + `</li>`;
    }

    household() {
        const rows = this.report.household.map((person) => this.householdRow(person));
        return `<section aria-labelledby="house">`
            + `<h2 class="section-head" id="house">Household</h2>`
            + rows.join('')
            + `</section>`;
    }

    householdRow(person) {
        const share = this.isHidden && !person.earned ? 0 : Math.min(person.value / person.target, 1);
        const percent = Math.round(share * 100);
        const colour = person.earned ? this.definition.colour : '';
        const link = awardLink(this.report.achievementId, person.id);
        return `<div class="household-row">`
            + `<div class="household-head">`
            + `<span class="row-person">`
            + `<span class="mini-avatar" aria-hidden="true">${escapeHtml(initialOf(person.name))}</span>`
            + `<a class="row-name" href="${link}">${escapeHtml(person.name)}</a></span>`
            + `<span class="figure" style="color: ${colour}">${escapeHtml(this.householdStatus(person))}</span>`
            + `</div>`
            + `<div class="meter" role="progressbar" aria-label="${escapeHtml(person.name)} progress" `
            + `aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">`
            + `<div class="meter-fill" style="width: ${percent}%; background: ${this.definition.colour}"></div>`
            + `</div></div>`;
    }

    // A secret award shows who has it, but not how far the others are.
    householdStatus(person) {
        if (person.earned) {
            return `Won ${formatDay(person.awardedAt)}`;
        }
        if (this.isHidden) {
            return 'Not yet';
        }
        return progressText(person, this.definition);
    }

    related() {
        const rows = this.report.related.map((entry) => this.relatedRow(entry));
        return `<section aria-labelledby="also">`
            + `<h2 class="section-head" id="also">Also on the ballot</h2>`
            + `<ul class="side-list">${rows.join('')}</ul>`
            + `</section>`;
    }

    relatedRow(entry) {
        const definition = this.definitions.get(entry.id);
        const state = entry.earned
            ? 'Won'
            : progressText(entry, definition);
        return `<li><a class="side-row plain" href="${awardLink(entry.id, this.report.user.id)}">`
            + `<span class="dot" style="background: ${definition.colour}" aria-hidden="true"></span>`
            + `<span class="stack"><span class="row-title">${escapeHtml(definition.title)}</span>`
            + `<span class="caption">${escapeHtml(definition.description)}</span></span>`
            + `<span class="caption">${escapeHtml(state)}</span>`
            + `</a></li>`;
    }

}
