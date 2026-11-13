import { escapeHtml } from './helpers/index.js';

const GUIDE_URL = 'https://github.com/winterborn/laurels/blob/main/docs/awards.md';
const GUIDE_LINK = `<a href="${GUIDE_URL}" target="_blank" rel="noopener">awards guide</a>`;
const SECRET_HELP = 'Laurels hides the name and the rule until a person wins the award. '
    + 'The person can choose to read them.';

const TIERS = [
    ['Common', 'Official selection'],
    ['Uncommon', 'Special mention'],
    ['Rare', 'Winner'],
    ['Epic', 'Grand prize'],
    ['Legendary', 'Lifetime achievement'],
];

const SECTIONS = [
    ['film', 'Film'],
    ['tv', 'Television'],
    ['both', 'Screen (film and TV)'],
];

// Rules to start from. The owner changes the numbers and the filter.
const TEMPLATES = [
    {
        label: 'Count films',
        rule: {
            type: 'count',
            filter: {
                kind: 'movie',
                genre: 'Western',
            },
            distinct: 'item',
            target: 10,
        },
    },
    {
        label: 'Count episodes',
        rule: {
            type: 'count',
            filter: {
                kind: 'episode',
                genre: 'Comedy',
            },
            target: 25,
        },
    },
    {
        label: 'A watch on a date',
        rule: {
            type: 'count',
            filter: {
                kind: 'movie',
                dates: ['12-25'],
            },
            target: 1,
        },
    },
    {
        label: 'Words in the title',
        rule: {
            type: 'count',
            filter: {
                kind: 'movie',
                titleWords: ['heist'],
            },
            distinct: 'item',
            target: 5,
        },
    },
    {
        label: 'Back to back',
        rule: {
            type: 'chain',
            steps: [
                {
                    genre: 'Horror',
                },
                {
                    genre: 'Comedy',
                },
            ],
            maxGapHours: 2,
            target: 1,
        },
    },
    {
        label: 'Different kinds',
        rule: {
            type: 'variety',
            of: 'decade',
            filter: {
                kind: 'movie',
            },
            target: 5,
        },
    },
    {
        label: 'Hours in one day',
        rule: {
            type: 'window',
            span: 'day',
            measure: 'hours',
            target: 6,
        },
    },
    {
        label: 'Every episode of a show',
        rule: {
            type: 'complete',
            set: 'show',
            target: 1,
        },
    },
];

// The "Your awards" panel on the Settings page. The owner adds awards,
// changes or removes built-in awards, checks a rule, then saves awards.json.
export class AwardsEditor {

    constructor(api) {
        this.api = api;
        this.entries = [];
        this.builtIn = [];
        this.problems = new Map();
        this.editing = null;
        this.root = null;
    }

    async mount(container) {
        const root = document.createElement('section');
        root.className = 'awards-editor';
        container.replaceChildren(root);
        this.root = root;
        root.addEventListener('click', (event) => this.onClick(event));
        root.addEventListener('change', (event) => this.onChange(event));
        await this.load();
    }

    async load() {
        const result = await this.api.getResult('/api/settings/awards');
        if (!result.ok) {
            this.root.innerHTML = `<p class="message bad">${escapeHtml(result.body.error ?? 'Laurels cannot read your awards.')}</p>`;
            return;
        }
        this.entries = result.body.entries;
        this.builtIn = result.body.builtIn;
        this.fileError = result.body.fileError;
        this.paint();
    }

    paint() {
        this.root.innerHTML = `<fieldset class="panel">`
            + `<legend>Your awards</legend>`
            + this.intro()
            + this.list()
            + this.actions()
            + this.form()
            + this.saveBar()
            + `</fieldset>`;
    }

    // Parts of the panel

    intro() {
        const fileError = this.fileError
            ? `<p class="message bad">${escapeHtml(this.fileError)}</p>`
            : '';
        return `<p class="help">Your awards have their own Save awards button. `
            + `Save settings does not save them.</p>`
            + `<p class="help">Add your own awards, or change and remove the built-in awards. `
            + `Laurels keeps them in <code>awards.json</code>. Each change counts after you click Save awards. `
            + `The rule types and filters are in the ${GUIDE_LINK}.</p>`
            + fileError;
    }

    list() {
        if (!this.entries.length) {
            return '<p class="help">You have no awards of your own yet.</p>';
        }
        const rows = this.entries.map((entry, index) => this.row(entry, index));
        return `<ul class="award-list">${rows.join('')}</ul>`;
    }

    row(entry, index) {
        const problem = this.problems.get(index);
        const problemText = problem ? `<span class="message bad">${escapeHtml(problem)}</span>` : '';
        const editButton = entry.remove
            ? ''
            : `<button type="button" class="button" data-action="edit" data-index="${index}">Change</button>`;
        const deleteLabel = this.builtInById(entry.id) ? 'Undo' : 'Delete';
        return `<li class="award-entry">`
            + `<span class="stack"><span class="row-title">${escapeHtml(this.rowTitle(entry))}</span>`
            + `<span class="caption">${escapeHtml(this.rowCaption(entry))}</span>${problemText}</span>`
            + `<span class="row">${editButton}`
            + `<button type="button" class="button" data-action="delete" data-index="${index}">${deleteLabel}</button></span>`
            + `</li>`;
    }

    // "Inside job", "Changed: Regular", "Removed: Graveyard slot".
    rowTitle(entry) {
        const builtIn = this.builtInById(entry.id);
        if (entry.remove) {
            return `Removed: ${builtIn?.title ?? entry.id}`;
        }
        if (builtIn) {
            return `Changed: ${entry.title ?? builtIn.title}`;
        }
        return entry.title ?? entry.id;
    }

    rowCaption(entry) {
        if (entry.remove) {
            return 'Laurels does not use this built-in award.';
        }
        const merged = {
            ...this.builtInById(entry.id),
            ...entry,
        };
        const tier = TIERS.find(([key]) => key === merged.tier)?.[1] ?? merged.tier;
        const section = SECTIONS.find(([key]) => key === merged.section)?.[1] ?? merged.section;
        return `${tier} · ${section} · ${merged.description ?? ''}`;
    }

    actions() {
        const options = this.builtIn
            .map((award) => `<option value="${escapeHtml(award.id)}">${escapeHtml(award.title)}</option>`)
            .join('');
        return `<div class="row">`
            + `<button type="button" class="button" data-action="add">Add an award</button>`
            + `</div>`
            + `<div class="row">`
            + `<label class="field grow"><span class="label">A built-in award</span>`
            + `<select name="builtIn">${options}</select></label>`
            + `<button type="button" class="button" data-action="change">Change it</button>`
            + `<button type="button" class="button" data-action="remove">Remove it</button>`
            + `</div>`;
    }

    saveBar() {
        return `<div class="row awards-save">`
            + `<button type="button" class="button primary" data-action="save">Save awards</button>`
            + `<span class="message" id="awards-message" role="status"></span>`
            + `</div>`;
    }

    // The form

    form() {
        if (this.editing === null) {
            return '';
        }
        const entry = this.editing.entry;
        return `<div class="award-form">`
            + `<h3 class="section-head">${this.editing.index === null ? 'New award' : 'Edit award'}</h3>`
            + this.textInput('title', 'Name', entry.title, 'Inside job')
            + this.textInput('description', 'What to watch', entry.description, 'Watch 5 different heist films.')
            + this.textInput('flavorText', 'Citation (starts with "For")', entry.flavorText, 'For planning the perfect crime.')
            + this.choiceInput('tier', 'Tier', TIERS, entry.tier ?? 'Common')
            + this.choiceInput('section', 'Category', SECTIONS, entry.section ?? 'film')
            + this.secretInput(entry.secret)
            + this.ruleInput(entry.rule)
            + `<div class="row">`
            + `<button type="button" class="button" data-action="check">Check</button>`
            + `<button type="button" class="button primary" data-action="done">Done</button>`
            + `<button type="button" class="button" data-action="cancel">Cancel</button>`
            + `</div>`
            + `<div id="check-result" role="status"></div>`
            + `</div>`;
    }

    textInput(name, label, value, placeholder) {
        return `<label class="field"><span class="label">${escapeHtml(label)}</span>`
            + `<input type="text" name="${name}" value="${escapeHtml(value ?? '')}" `
            + `placeholder="${escapeHtml(placeholder)}" autocomplete="off"></label>`;
    }

    choiceInput(name, label, choices, current) {
        const options = choices.map(([value, text]) => {
            const selected = value === current ? ' selected' : '';
            return `<option value="${value}"${selected}>${escapeHtml(text)}</option>`;
        });
        return `<label class="field"><span class="label">${escapeHtml(label)}</span>`
            + `<select name="${name}">${options.join('')}</select></label>`;
    }

    secretInput(isSecret) {
        const checked = isSecret ? ' checked' : '';
        return `<label class="choice"><input type="checkbox" name="secret" value="true"${checked}>`
            + `<span><span class="label">Secret</span><br>`
            + `<span class="help">${SECRET_HELP}</span></span></label>`;
    }

    // A new award starts from the first template. A changed award can keep its rule.
    ruleInput(rule) {
        const isNew = !rule;
        const options = TEMPLATES.map((template, index) => {
            const selected = isNew && index === 0 ? ' selected' : '';
            return `<option value="${index}"${selected}>${escapeHtml(template.label)}</option>`;
        });
        const keep = isNew ? '' : '<option value="">Keep this rule</option>';
        const text = JSON.stringify(rule ?? TEMPLATES[0].rule, null, 4);
        return `<div class="row">`
            + `<label class="field grow"><span class="label">Start from</span>`
            + `<select name="template">${keep}${options.join('')}</select></label>`
            + `</div>`
            + `<label class="field"><span class="label">Rule (JSON)</span>`
            + `<textarea name="rule" rows="12" spellcheck="false">${escapeHtml(text)}</textarea>`
            + `<span class="help">Change the numbers and the filter. Click Check to see each person's progress.</span>`
            + `</label>`;
    }

    // Events

    onClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }
        const index = Number(button.dataset.index);
        switch (button.dataset.action) {
            case 'add':
                this.startNew();
                return;
            case 'change':
                this.startChange();
                return;
            case 'remove':
                this.addRemoval();
                return;
            case 'edit':
                this.startEdit(index);
                return;
            case 'delete':
                this.deleteEntry(index);
                return;
            case 'check':
                this.check();
                return;
            case 'done':
                this.finishEdit();
                return;
            case 'cancel':
                this.closeForm();
                return;
            case 'save':
                this.save();
                return;
        }
    }

    // "Start from" fills the rule box with a template.
    onChange(event) {
        const isTemplate = event.target.name === 'template' && event.target.value !== '';
        if (!isTemplate) {
            return;
        }
        const template = TEMPLATES[Number(event.target.value)];
        this.root.querySelector('textarea[name="rule"]').value = JSON.stringify(template.rule, null, 4);
    }

    startNew() {
        this.openForm(null, {
            tier: 'Common',
            section: 'film',
        });
    }

    startChange() {
        const award = this.builtInById(this.selectedBuiltIn());
        if (!award) {
            return;
        }
        const index = this.entries.findIndex((entry) => entry.id === award.id);
        const existing = index >= 0 ? this.entries[index] : {};
        this.openForm(index >= 0 ? index : null, {
            ...award,
            ...existing,
        });
    }

    addRemoval() {
        const id = this.selectedBuiltIn();
        const others = this.entries.filter((entry) => entry.id !== id);
        this.entries = [...others, {
            id,
            remove: true,
        }];
        this.paint();
        this.say('Not saved yet. Click Save awards.', true);
    }

    startEdit(index) {
        const entry = this.entries[index];
        this.openForm(index, {
            ...this.builtInById(entry.id),
            ...entry,
        });
    }

    deleteEntry(index) {
        this.entries = this.entries.filter((_, position) => position !== index);
        this.problems = new Map();
        this.paint();
        this.say('Not saved yet. Click Save awards.', true);
    }

    openForm(index, entry) {
        this.editing = {
            index,
            entry,
        };
        this.paint();
        this.root.querySelector('.award-form input[name="title"]')?.focus();
    }

    closeForm() {
        this.editing = null;
        this.paint();
    }

    // Done: the form goes into the list. Save awards writes the list.
    finishEdit() {
        const entry = this.readForm();
        if (!entry) {
            return;
        }
        const index = this.editing.index;
        this.entries = index === null
            ? [...this.entries, entry]
            : this.entries.map((existing, position) => (position === index ? entry : existing));
        this.editing = null;
        this.problems = new Map();
        this.paint();
        this.say('Not saved yet. Click Save awards.', true);
    }

    async check() {
        const entry = this.readForm();
        if (!entry) {
            return;
        }
        const result = await this.api.post('/api/settings/awards/check', {
            entry,
        });
        this.showCheck(result, entry.rule.target);
    }

    showCheck(result, target) {
        const box = this.root.querySelector('#check-result');
        if (!result.ok) {
            box.innerHTML = `<p class="message bad">${escapeHtml(result.body.error)}</p>`;
            return;
        }
        const people = result.body.people.map((person) => {
            const state = person.earned ? 'won' : `${person.value} of ${person.target} ${person.unit}`;
            return `<li>${escapeHtml(person.name)}: ${escapeHtml(state)}</li>`;
        });
        const works = `The rule works. The target is ${target}. `
            + 'Check that "What to watch" gives the same number. Progress now:';
        box.innerHTML = `<p class="message good">${escapeHtml(works)}</p>`
            + `<ul class="check-list">${people.join('')}</ul>`;
    }

    async save() {
        this.say('Saving…', true);
        const result = await this.api.post('/api/settings/awards', {
            entries: this.entries,
        });
        if (!result.ok) {
            this.problems = new Map((result.body.problems ?? []).map((problem) => [problem.index, problem.problem]));
            this.paint();
            this.say(result.body.error, false);
            return;
        }
        this.entries = result.body.entries;
        this.fileError = '';
        this.problems = new Map();
        this.paint();
        this.say('Saved. Laurels counts the awards again now.', true);
        window.dispatchEvent(new CustomEvent('laurels:saved'));
    }

    // Helpers

    // The form as an entry. Shows a message and returns null if the rule is not valid JSON.
    readForm() {
        const form = this.root.querySelector('.award-form');
        const rule = this.parseRule(form.querySelector('textarea[name="rule"]').value);
        if (!rule) {
            return null;
        }
        const value = (name) => form.querySelector(`[name="${name}"]`).value.trim();
        const title = value('title');
        return {
            id: this.editing.entry.id ?? this.newId(title),
            title,
            description: value('description'),
            flavorText: value('flavorText'),
            tier: value('tier'),
            section: value('section'),
            secret: form.querySelector('[name="secret"]').checked,
            rule,
        };
    }

    parseRule(text) {
        try {
            return JSON.parse(text);
        } catch (error) {
            const box = this.root.querySelector('#check-result');
            box.innerHTML = `<p class="message bad">The rule is not valid JSON: ${escapeHtml(error.message)}</p>`;
            return null;
        }
    }

    // "Inside job" -> "my_inside_job", with a number if the id is taken.
    newId(title) {
        const base = `my_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'award'}`;
        const taken = new Set([...this.entries, ...this.builtIn].map((entry) => entry.id));
        const numbers = Array.from({ length: 100 }, (_, index) => index + 2);
        const free = numbers.find((number) => !taken.has(`${base}_${number}`));
        return taken.has(base) ? `${base}_${free}` : base;
    }

    selectedBuiltIn() {
        return this.root.querySelector('select[name="builtIn"]').value;
    }

    builtInById(id) {
        return this.builtIn.find((award) => award.id === id);
    }

    say(text, isOk) {
        const message = this.root.querySelector('#awards-message');
        if (!message) {
            return;
        }
        message.textContent = text;
        message.className = isOk ? 'message good' : 'message bad';
    }

}
