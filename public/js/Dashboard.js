import { Api } from './Api.js';
import { AwardsView } from './AwardsView.js';
import { AwardView } from './AwardView.js';
import { BallotView } from './BallotView.js';
import { CeremonyView } from './CeremonyView.js';
import { LoginView } from './LoginView.js';
import { PlexSignIn } from './PlexSignIn.js';
import { PremiereWatcher } from './PremiereWatcher.js';
import { PressRoomView } from './PressRoomView.js';
import { SeasonView } from './SeasonView.js';
import { SettingsView } from './SettingsView.js';
import {
    escapeHtml,
    initialOf,
    onceThisVisit,
    runMeters,
    wireFallbacks,
} from './helpers/index.js';

// Routes (one for each page, named like its menu label):
//   #/ or #/awards/<id>         one person's awards (your own when signed in)
//   #/ballot/<id>               every award, as a ballot
//   #/award/<achievement>/<id>  one award for one person
//   #/ceremony[/year|month]     the household standings
//   #/press-room                new awards, week by week
//   #/season/<id>[/<year>]      one person's season
//   #/settings                  owner only
export class Dashboard {

    constructor(page, household, account) {
        this.page = page;
        this.household = household;
        this.account = account;
        this.api = new Api();
        this.pageKind = 'awards';
        this.premieres = new PremiereWatcher(this.api);
        this.hasShown = false;
    }

    async start() {
        window.addEventListener('hashchange', () => this.show());
        window.addEventListener('laurels:saved', () => this.refreshAfterSave());
        window.addEventListener('laurels:signed-in', () => this.show());
        this.account.addEventListener('click', (event) => this.onAccount(event));
        this.household.addEventListener('click', (event) => this.onPerson(event));
        document.querySelector('.skip-link').addEventListener('click', (event) => this.skipToPage(event));
        await this.resumeSignIn();
        await this.show();
    }

    async show() {
        try {
            await this.showRoute();
            this.afterRender();
        } catch (error) {
            await this.showError(error);
        }
    }

    // A cut to the top of the new page. Meters run once per page per visit.
    afterRender() {
        wireFallbacks(this.page);
        window.scrollTo(0, 0);
        requestAnimationFrame(() => window.scrollTo(0, 0));
        if (onceThisVisit(location.hash || '#/')) {
            runMeters(this.page);
        }
        this.focusTitle();
    }

    // After a page change, focus moves to the new title.
    // The first page keeps the focus where the browser put it.
    focusTitle() {
        if (!this.hasShown) {
            this.hasShown = true;
            return;
        }
        const title = this.page.querySelector('h1') ?? this.page;
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll: true });
    }

    // The skip link moves focus without a change to the route.
    skipToPage(event) {
        event.preventDefault();
        this.page.focus();
    }

    // A lost session sends the person back to the sign-in page.
    async showError(error) {
        if (error.status === 401) {
            await this.show();
            return;
        }
        this.page.innerHTML = `<p class="empty">Laurels could not show this page. ${escapeHtml(error.message)}</p>`
            + `<p><a href="#/">Go to your awards</a></p>`;
    }

    async showRoute() {
        const me = await this.api.me();
        this.renderAccount(me);
        if (!me.role) {
            this.showLogin(me);
            return;
        }
        const route = location.hash.replace(/^#\/?/, '');
        const status = await this.api.status();
        const isOwner = me.role === 'owner';
        if (!status.configured && !isOwner) {
            this.page.innerHTML = '<p class="empty">The owner has not finished setting up Laurels yet.</p>';
            return;
        }
        const wantsSettings = isOwner && (route === 'settings' || !status.configured);
        if (wantsSettings) {
            await this.showSettings(status);
            return;
        }
        const parts = route.split('/').map((part) => decodeURIComponent(part));
        const [users, definitionList] = await Promise.all([
            this.api.users(),
            this.api.definitions(),
        ]);
        const definitions = new Map(definitionList.map((definition) => [definition.id, definition]));
        const ownId = this.ownIdIn(users, me.accountId);
        this.premieres.start(ownId);
        await this.showPage(parts, users, definitions, ownId);
    }

    async showPage(parts, users, definitions, ownId) {
        switch (parts[0]) {
            case 'ballot':
                await this.showBallot(users, definitions, parts[1] || ownId);
                return;
            case 'award':
                await this.showAward(users, definitions, parts[1], parts[2] || ownId);
                return;
            case 'ceremony':
                await this.showCeremony(definitions, parts[1] ?? 'all');
                return;
            case 'press-room':
                await this.showPressRoom(definitions);
                return;
            case 'season':
                await this.showSeason(users, definitions, parts[1] || ownId, parts[2]);
                return;
            default:
                await this.showAwards(users, definitions, parts[1] || ownId);
        }
    }

    // Your own id if you watch on this server, else the top of the standings.
    ownIdIn(users, accountId) {
        const isListed = users.some((user) => user.id === accountId);
        return isListed ? accountId : users[0]?.id ?? '';
    }

    async showAwards(users, definitions, userId) {
        const user = users.find((candidate) => candidate.id === userId) ?? users[0];
        if (!user) {
            this.page.innerHTML = '<p class="empty">No one has watched anything yet.</p>';
            return;
        }
        const cabinet = await this.api.cabinet(user.id);
        this.renderHousehold(users, user.id);
        this.setPage('awards', `${user.name}'s awards`);
        this.page.innerHTML = new AwardsView(this.api, definitions, cabinet, user).render();
    }

    async showBallot(users, definitions, userId) {
        const cabinet = await this.api.cabinet(userId);
        this.renderHousehold(users, userId);
        this.setPage('ballot', `${cabinet.user.name}'s ballot`);
        new BallotView(this.api, definitions, cabinet, users).mount(this.page);
    }

    async showAward(users, definitions, achievementId, userId) {
        const report = await this.api.award(achievementId, userId);
        this.renderHousehold(users, userId);
        const view = new AwardView(this.api, definitions, report);
        this.setPage('award', view.pageTitle);
        this.page.innerHTML = view.render();
    }

    async showCeremony(definitions, range) {
        const report = await this.api.ceremony(range);
        this.renderHousehold([], '');
        this.setPage('ceremony', 'Ceremony');
        this.page.innerHTML = new CeremonyView(this.api, definitions, report).render();
    }

    async showPressRoom(definitions) {
        const awards = await this.api.awards();
        this.renderHousehold([], '');
        this.setPage('press-room', 'Press room');
        this.page.innerHTML = new PressRoomView(this.api, definitions, awards).render();
    }

    async showSeason(users, definitions, userId, year) {
        const report = await this.api.season(userId, year);
        this.renderHousehold(users, userId);
        this.setPage('season', `${report.user.name}'s season`);
        this.page.innerHTML = new SeasonView(this.api, definitions, report).render();
    }

    setPage(kind, title) {
        this.pageKind = kind;
        this.markPage(kind);
        document.title = `${title} · Laurels`;
    }

    // Back from Plex in the same tab: finish the sign-in first.
    async resumeSignIn() {
        const signIn = new PlexSignIn(this.api);
        if (!signIn.pending()) {
            return;
        }
        this.page.innerHTML = '<p class="loading">Finishing sign-in…</p>';
        const result = await signIn.resume();
        if (result && !result.ok) {
            this.page.innerHTML = `<p class="empty">${escapeHtml(result.error)}</p>`;
            await new Promise((resolve) => setTimeout(resolve, 2500));
        }
    }

    showLogin(me) {
        this.renderHousehold([], '');
        new LoginView(this.api, me).mount(this.page);
        document.title = 'Sign in · Laurels';
    }

    // Name, Settings link (owner only) and Sign out.
    renderAccount(me) {
        const settingsLink = document.querySelector('[data-page="settings"]');
        settingsLink.hidden = me.role !== 'owner';
        document.querySelector('.nav-links').hidden = !me.role;
        const canSignOut = me.authMode === 'plex' && me.role && me.role !== 'guest';
        if (!canSignOut) {
            this.account.innerHTML = '';
            return;
        }
        this.account.innerHTML = `<span class="account-name">${escapeHtml(me.name)}</span>`
            + `<button type="button" class="link-button" data-action="sign-out">Sign out</button>`;
    }

    async onAccount(event) {
        const button = event.target.closest('[data-action="sign-out"]');
        if (!button) {
            return;
        }
        this.premieres.stop();
        await this.api.signOut();
        location.hash = '#/';
        await this.show();
    }

    async showSettings(status) {
        const settings = await this.api.settings();
        this.renderHousehold([], '');
        this.markPage('settings');
        new SettingsView(this.api, settings, status).mount(this.page);
        document.title = 'Settings · Laurels';
    }

    // After saving, wait for the first sync, then show the awards.
    async refreshAfterSave() {
        const status = await this.api.status();
        if (status.syncing) {
            setTimeout(() => this.refreshAfterSave(), 1500);
            return;
        }
        const isFirstSetup = location.hash !== '#/settings';
        if (isFirstSetup && status.configured) {
            await this.show();
            return;
        }
        window.dispatchEvent(new CustomEvent('laurels:synced', { detail: status }));
    }

    renderHousehold(users, currentId) {
        const buttons = users.map((user) => {
            const pressed = user.id === currentId;
            const name = escapeHtml(user.name);
            return `<button type="button" class="person" data-user="${escapeHtml(user.id)}" `
                + `aria-pressed="${pressed}" title="${name}" aria-label="${name}">`
                + `${escapeHtml(initialOf(user.name))}</button>`;
        });
        this.household.innerHTML = buttons.join('');
    }

    markPage(page) {
        for (const link of document.querySelectorAll('.nav-links a')) {
            const isCurrent = link.dataset.page === page;
            if (isCurrent) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        }
    }

    // The person buttons keep you on the same kind of page.
    onPerson(event) {
        const button = event.target.closest('[data-user]');
        if (!button) {
            return;
        }
        const userId = encodeURIComponent(button.dataset.user);
        switch (this.pageKind) {
            case 'ballot':
                location.hash = `#/ballot/${userId}`;
                return;
            case 'season':
                location.hash = `#/season/${userId}`;
                return;
            case 'award':
                location.hash = location.hash.replace(/[^/]+$/, userId);
                return;
            default:
                location.hash = `#/awards/${userId}`;
        }
    }

}
