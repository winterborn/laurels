import { escapeHtml } from './helpers/index.js';
import { Laurel } from './Laurel.js';
import { PlexSignIn } from './PlexSignIn.js';

const ABOUT = 'Your household wins awards for the films and TV that it watches.';
const SIGN_IN_LEDE = `${ABOUT} Sign in with your Plex account to see them.`;
const SETUP_LEDE = `${ABOUT} Sign in with the Plex account that owns your server. `
    + 'This account becomes the Laurels owner. Only the owner can change the settings.';

// The page people see before they sign in.
export class LoginView {

    constructor(api, me) {
        this.api = api;
        this.me = me;
        this.root = null;
    }

    mount(root) {
        this.root = root;
        root.innerHTML = this.render();
        root.querySelector('[data-action="sign-in"]').addEventListener('click', () => this.signIn());
    }

    // An opening title card: laurel, name, billing, then the one action.
    render() {
        const isSetup = !this.me.hasOwner;
        const kicker = isSetup ? 'Set up' : 'Sign in';
        const lede = isSetup ? SETUP_LEDE : SIGN_IN_LEDE;
        return `<section class="title-card" aria-labelledby="title-card-name">`
            + `<span class="title-card-laurel">${Laurel.svg('currentColor', 'Rare')}</span>`
            + `<span class="eyebrow">${kicker}</span>`
            + `<h1 class="title-card-name" id="title-card-name">Laurels</h1>`
            + `<span class="eyebrow">An achievement system for Plex</span>`
            + `<p class="lede-plain">${escapeHtml(lede)}</p>`
            + `<div class="row">`
            + `<button type="button" class="button primary" data-action="sign-in">Sign in with Plex</button>`
            + `<span class="message" id="login-message" role="status"></span>`
            + `</div>`
            + `<p class="help">Plex opens in a new window. Laurels does not see your Plex password.</p>`
            + `</section>`;
    }

    async signIn() {
        const signIn = new PlexSignIn(this.api);
        const result = await signIn.run(() => this.say('Waiting for you to sign in to Plex…', true));
        if (!result.ok) {
            this.say(result.error, false);
            return;
        }
        this.say(`Signed in as ${result.name}.`, true);
        window.dispatchEvent(new CustomEvent('laurels:signed-in'));
    }

    say(text, isGood) {
        const element = this.root.querySelector('#login-message');
        element.textContent = text;
        element.classList.toggle('bad', !isGood);
    }

}
