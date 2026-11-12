import {
    escapeHtml,
    formatClock,
    formatDay,
} from './helpers/index.js';
import { PlexSignIn } from './PlexSignIn.js';

const ENV_NAMES = {
    plexUrl: 'PLEX_URL',
    pollMinutes: 'POLL_MINUTES',
    timeZone: 'TZ',
    discordWebhookUrl: 'DISCORD_WEBHOOK_URL',
    publicUrl: 'PUBLIC_URL',
    notifyBackfillDays: 'NOTIFY_BACKFILL_DAYS',
    userAliases: 'USER_ALIASES',
    allowedUsers: 'ALLOWED_USERS',
    authMode: 'AUTH',
    lanGuests: 'LAN_GUESTS',
};

// Settings and first-run setup. Owns its own form events.
export class SettingsView {

    constructor(api, settings, status) {
        this.api = api;
        this.settings = settings;
        this.status = status;
        this.root = null;
    }

    // Renders into a new element each time, so old listeners go with it.
    mount(page) {
        const root = document.createElement('div');
        root.className = 'view';
        page.replaceChildren(root);
        this.root = root;
        root.innerHTML = this.render();
        root.querySelector('form').addEventListener('submit', (event) => this.onSave(event));
        root.addEventListener('click', (event) => this.onClick(event));
        if (this.settings.plexTokenSet && !this.status.configured) {
            this.loadServers();
        }
    }

    render() {
        return this.intro()
            + `<form class="settings" novalidate>`
            + this.plexSection()
            + this.scheduleSection()
            + this.discordSection()
            + this.householdSection()
            + this.securitySection()
            + `<div class="save-bar">`
            + `<button type="submit" class="button primary">Save settings</button>`
            + `<span class="message" id="save-message" role="status"></span>`
            + `</div>`
            + `</form>`
            + `<p class="help disclaimer">Laurels works with Plex Media Server. Laurels is not made or endorsed by Plex, Inc.</p>`;
    }

    intro() {
        if (this.status.configured) {
            return `<header class="page-intro"><h1 class="page-title">Settings</h1>`
                + `<p class="lede">${escapeHtml(this.syncLine())}</p></header>`;
        }
        return `<header class="page-intro"><h1 class="page-title">Set up Laurels</h1>`
            + `<ol class="steps">`
            + `<li>Select your server below, or type its address.</li>`
            + `<li>Click Test connection.</li>`
            + `<li>Click Save settings. Laurels reads your watch history and gives the first awards.</li>`
            + `</ol></header>`;
    }

    syncLine() {
        const last = this.status.lastSync;
        if (this.status.syncing) {
            return 'Reading your watch history now…';
        }
        if (!last) {
            return 'Not synced yet.';
        }
        const when = `${formatDay(last.at)} at ${formatClock(last.at)}`;
        if (!last.ok) {
            return `Last sync failed (${when}): ${last.message}`;
        }
        return `Last sync ${when}: ${last.message}. `
            + `${this.status.users} people, ${this.status.watches} watches, ${this.status.awards} awards.`;
    }

    // Plex

    plexSection() {
        const tokenLine = this.settings.plexTokenSet
            ? 'Laurels is connected to Plex.'
            : 'Laurels is not connected to Plex. Click Sign in with Plex.';
        const signInLabel = this.settings.plexTokenSet ? 'Sign in again' : 'Sign in with Plex';
        const findButton = this.settings.plexTokenSet
            ? `<button type="button" class="button" data-action="find-servers">Find my servers</button>`
            : '';
        return `<fieldset class="panel">`
            + `<legend>Plex server</legend>`
            + `<div class="row">`
            + `<button type="button" class="button" data-action="sign-in">${signInLabel}</button>`
            + findButton
            + `<span class="message" id="sign-in-message" role="status">${escapeHtml(tokenLine)}</span>`
            + `</div>`
            + `<div id="server-list" class="server-list"></div>`
            + this.textField('plexUrl', 'Server address', 'http://plex:32400',
                'If Plex is on the same Docker network, use http://plex:32400. If not, use the IP address of the server, for example http://192.168.1.10:32400.')
            + `<details class="advanced"><summary>Paste a token instead</summary>`
            + `<label class="field"><span class="label">Plex token</span>`
            + `<input type="password" name="plexToken" autocomplete="off" placeholder="${this.settings.plexTokenSet ? 'Saved. Paste to replace.' : ''}">`
            + `<span class="help">In Plex Web, open a film. Select Get Info, then View XML. Copy the value of X-Plex-Token from the address.</span>`
            + `</label></details>`
            + `<div class="row">`
            + `<button type="button" class="button" data-action="test-plex">Test connection</button>`
            + `<span class="message" id="plex-message" role="status"></span>`
            + `</div>`
            + `</fieldset>`;
    }

    // Schedule

    scheduleSection() {
        return `<fieldset class="panel">`
            + `<legend>Schedule</legend>`
            + this.numberField('pollMinutes', 'Time between checks for new watches (minutes)', 1, 'New watches show in Laurels after one check.')
            + this.timeZoneField()
            + `<div class="row">`
            + `<button type="button" class="button" data-action="check-now">Check now</button>`
            + `<span class="message" id="check-message" role="status"></span>`
            + `</div>`
            + `</fieldset>`
            + this.demoSection();
    }

    timeZoneField() {
        const current = this.settings.values.timeZone;
        const options = this.settings.timeZones.map((zone) => {
            const selected = zone === current ? ' selected' : '';
            return `<option${selected}>${escapeHtml(zone)}</option>`;
        });
        return `<label class="field"><span class="label">Time zone</span>`
            + `<select name="timeZone"${this.lockAttr('timeZone')}>${options.join('')}</select>`
            + `<span class="help">${this.helpFor('timeZone', 'Laurels uses it for times of day, days and streaks.')}</span>`
            + `</label>`;
    }

    // Demo only: add a watch that wins an award.
    demoSection() {
        if (!this.settings.demo) {
            return '';
        }
        return `<fieldset class="panel">`
            + `<legend>Demo</legend>`
            + `<p class="help">Adds one watch on the mock server that wins a new award, then checks for new watches. The "Just announced" popup opens on any page.</p>`
            + `<div class="row">`
            + `<button type="button" class="button" data-action="demo-watch">Add a winning watch</button>`
            + `<span class="message" id="demo-message" role="status"></span>`
            + `</div>`
            + `</fieldset>`;
    }

    // Discord

    discordSection() {
        return `<fieldset class="panel">`
            + `<legend>Discord</legend>`
            + this.textField('discordWebhookUrl', 'Webhook URL', 'https://discord.com/api/webhooks/…',
                'In Discord, open the channel settings. Select Integrations, Webhooks, New Webhook, then Copy Webhook URL.')
            + this.textField('publicUrl', 'Public address of Laurels (optional)', 'https://laurels.example.com',
                'Discord uses this address to show posters. Leave it empty if Laurels is only on your home network.')
            + this.numberField('notifyBackfillDays', 'Days before the first sync to include in Discord', 0,
                'With 0, Discord gets only the awards from after the first sync.')
            + `<div class="row">`
            + `<button type="button" class="button" data-action="test-discord">Send test message</button>`
            + `<span class="message" id="discord-message" role="status"></span>`
            + `</div>`
            + `</fieldset>`;
    }

    // Household

    householdSection() {
        return `<fieldset class="panel">`
            + `<legend>Household</legend>`
            + this.textField('userAliases', 'Names to show', '1:Mum, 2:Dad',
                'Write the account id, a colon and the name. Separate the people with commas.')
            + this.textField('allowedUsers', 'People to show', 'Mum, Dad',
                'Write names or account ids, with commas between them. If you leave it empty, Laurels shows everyone who watched something.')
            + `</fieldset>`;
    }

    // Security

    securitySection() {
        const mode = this.settings.values.authMode;
        const lock = this.lockAttr('authMode');
        const plexChecked = mode === 'plex' ? ' checked' : '';
        const offChecked = mode === 'off' ? ' checked' : '';
        const guestsChecked = this.settings.values.lanGuests ? ' checked' : '';
        return `<fieldset class="panel">`
            + `<legend>Sign-in</legend>`
            + `<label class="choice"><input type="radio" name="authMode" value="plex"${plexChecked}${lock}>`
            + `<span><span class="label">Sign in with Plex</span><br>`
            + `<span class="help">Recommended. The owner can change the settings. People who share your server can see the awards.</span></span></label>`
            + `<label class="choice"><input type="radio" name="authMode" value="off"${offChecked}${lock}>`
            + `<span><span class="label">No sign-in</span><br>`
            + `<span class="help">Use this only behind a proxy that has its own sign-in, for example Authelia. Without it, any visitor can change the settings.</span></span></label>`
            + `<span class="help">${this.isLocked('authMode') ? this.helpFor('authMode', '') : ''}</span>`
            + `<label class="choice"><input type="checkbox" name="lanGuests" value="true"${guestsChecked}${this.lockAttr('lanGuests')}>`
            + `<span><span class="label">Guest view on the home network</span><br>`
            + `<span class="help">${this.helpFor('lanGuests', 'Use this for a TV browser. Keep it off if port 8484 is open to the internet. A visit through a proxy always needs a sign-in.')}</span></span></label>`
            + `</fieldset>`;
    }

    // Fields

    textField(name, label, placeholder, help) {
        const value = this.settings.values[name] ?? '';
        return `<label class="field"><span class="label">${escapeHtml(label)}</span>`
            + `<input type="text" name="${name}" value="${escapeHtml(value)}" `
            + `placeholder="${escapeHtml(placeholder)}" autocomplete="off"${this.lockAttr(name)}>`
            + `<span class="help">${this.helpFor(name, help)}</span>`
            + `</label>`;
    }

    numberField(name, label, min, help) {
        const value = this.settings.values[name] ?? '';
        return `<label class="field"><span class="label">${escapeHtml(label)}</span>`
            + `<input type="number" name="${name}" value="${escapeHtml(value)}" min="${min}"${this.lockAttr(name)}>`
            + `<span class="help">${this.helpFor(name, help)}</span>`
            + `</label>`;
    }

    isLocked(name) {
        return this.settings.locked.includes(name);
    }

    lockAttr(name) {
        return this.isLocked(name) ? ' disabled' : '';
    }

    helpFor(name, help) {
        if (!this.isLocked(name)) {
            return escapeHtml(help);
        }
        return `The variable <code>${ENV_NAMES[name]}</code> sets this value. Change it in your Docker settings.`;
    }

    // Events

    onClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }
        switch (button.dataset.action) {
            case 'sign-in':
                this.signIn();
                return;
            case 'test-plex':
                this.testPlex();
                return;
            case 'test-discord':
                this.testDiscord();
                return;
            case 'check-now':
                this.checkNow();
                return;
            case 'demo-watch':
                this.demoWatch();
                return;
            case 'find-servers':
                this.loadServers();
                return;
            case 'pick-server':
                this.pickServer(button.dataset.uri);
                return;
        }
    }

    async onSave(event) {
        event.preventDefault();
        const result = await this.api.post('/api/settings', this.formValues());
        if (!result.ok) {
            this.say('save-message', result.body.error, false);
            return;
        }
        this.settings = result.body;
        this.say('save-message', 'Saved. Reading your watch history…', true);
        window.addEventListener('laurels:synced', (synced) => this.onSynced(synced.detail), { once: true });
        window.dispatchEvent(new CustomEvent('laurels:saved'));
    }

    // Replaces "Reading your watch history…" with the result of the sync.
    onSynced(status) {
        this.status = status;
        const isOk = status.lastSync?.ok ?? true;
        this.say('save-message', this.syncLine(), isOk);
        const lede = this.root.querySelector('.lede');
        if (lede) {
            lede.textContent = this.syncLine();
        }
    }

    // Only editable fields; an empty token field keeps the saved token.
    formValues() {
        const form = this.root.querySelector('form');
        const data = new FormData(form);
        const entries = [...data.entries()].filter(([name, value]) => {
            const isEmptyToken = name === 'plexToken' && !value;
            return !isEmptyToken && !this.isLocked(name);
        });
        const values = Object.fromEntries(entries);
        if (!this.isLocked('lanGuests')) {
            values.lanGuests = data.has('lanGuests');
        }
        return values;
    }

    async testPlex() {
        this.say('plex-message', 'Testing…', true);
        const values = this.formValues();
        const result = await this.api.post('/api/settings/test-plex', {
            plexUrl: values.plexUrl ?? this.settings.values.plexUrl,
            plexToken: values.plexToken ?? '',
        });
        if (!result.ok) {
            this.say('plex-message', result.body.error, false);
            return;
        }
        const info = result.body;
        this.say('plex-message', `Connected to ${info.name} (Plex ${info.version}), ${info.accounts} accounts.`, true);
    }

    async checkNow() {
        this.say('check-message', 'Checking for new watches…', true);
        const result = await this.api.post('/api/settings/check-now', {});
        if (!result.ok) {
            this.say('check-message', result.body.error, false);
            return;
        }
        this.status = result.body;
        this.say('check-message', this.syncLine(), result.body.lastSync?.ok ?? true);
        window.dispatchEvent(new CustomEvent('laurels:check-premieres'));
    }

    async demoWatch() {
        this.say('demo-message', 'Adding a watch…', true);
        const result = await this.api.post('/api/settings/demo-watch', {});
        if (!result.ok) {
            this.say('demo-message', result.body.error, false);
            return;
        }
        const count = result.body.trophies.length;
        this.say('demo-message', `Added: ${result.body.title}. It wins ${count} ${count === 1 ? 'award' : 'awards'}.`, true);
        window.dispatchEvent(new CustomEvent('laurels:check-premieres'));
    }

    async testDiscord() {
        this.say('discord-message', 'Sending…', true);
        const values = this.formValues();
        const result = await this.api.post('/api/settings/test-discord', {
            discordWebhookUrl: values.discordWebhookUrl ?? '',
        });
        const message = result.ok ? 'Sent. Check the channel.' : result.body.error;
        this.say('discord-message', message, result.ok);
    }

    // Gets a fresh token from plex.tv, then lists the servers.
    async signIn() {
        const signIn = new PlexSignIn(this.api);
        const result = await signIn.run(() => this.say('sign-in-message', 'Waiting for you to sign in to Plex…', true));
        if (!result.ok) {
            this.say('sign-in-message', result.error, false);
            return;
        }
        if (result.role !== 'owner') {
            this.say('sign-in-message', 'That account is not the owner of this server.', false);
            return;
        }
        this.settings.plexTokenSet = true;
        this.say('sign-in-message', `You are signed in as ${result.name}. Select your server below.`, true);
        await this.loadServers();
    }

    async loadServers() {
        const list = this.root.querySelector('#server-list');
        const result = await this.api.getResult('/api/plex/servers');
        if (!result.ok) {
            list.innerHTML = `<p class="message bad">${escapeHtml(result.body.error)}</p>`;
            return;
        }
        list.innerHTML = result.body.map((server) => this.serverChoice(server)).join('');
    }

    serverChoice(server) {
        const buttons = server.connections.map((connection) => {
            const kind = connection.relay ? 'relay' : (connection.local ? 'local' : 'remote');
            return `<button type="button" class="button small" data-action="pick-server" `
                + `data-uri="${escapeHtml(connection.uri)}">${escapeHtml(connection.uri)} · ${kind}</button>`;
        });
        const owner = server.owned ? 'Your server' : 'Shared with you';
        return `<div class="server"><strong>${escapeHtml(server.name)}</strong>`
            + `<span class="help">${owner}. Local addresses are fastest.</span>`
            + `<div class="row">${buttons.join('')}</div></div>`;
    }

    pickServer(uri) {
        const input = this.root.querySelector('input[name="plexUrl"]');
        if (!input || input.disabled) {
            return;
        }
        input.value = uri;
        this.testPlex();
    }

    say(id, text, isGood) {
        const element = this.root.querySelector(`#${id}`);
        element.textContent = text;
        element.classList.toggle('bad', !isGood);
    }

}
