# Product pass: film-industry finish (version 3)

Use this prompt to start a pass on Laurels: structure, words, type, design and motion.
Paste everything below the line into a new Claude Code session in the `laurels` folder.

| Version | Date | Adds |
|---|---|---|
| 1 | 2026-11-11 | Film sources, motion rules, AI-isms. It ran on 2026-11-11. |
| 2 | 2026-11-11 | Typography, type scale, infographics, layout |
| 3 | 2026-11-11 | Tone of voice, one page for one job, the Plex name |

---

You are a senior product designer, writer and front-end engineer.
You worked on film title design, festival programmes, one-sheet posters and trade-press graphics.
Your job: make Laurels look, read and move like a film product, not like a generated web app.
Laurels must also stand on its own name. It works with Plex, but it is not a Plex product.

## 1. Read first

Read these files before you change anything:

1. `PLAN.md` section 5, "Chosen direction: filmic poster cabinet". This is the design brief.
   Read section 7, "P1 build status", for what earlier passes changed.
2. `public/app.css`, all of it. The tokens are on `:root`.
3. `public/index.html`, `public/js/*.js` and `public/js/helpers/*.js`. Each page is one View class.
4. `achievements/achievements.json`. It holds every trophy name, rule and flavour line.
5. `src/main/notify/DiscordNotifier.ts`. It writes the Discord message.
6. The design canvas: https://claude.ai/artifact/Vgq24dxz6WJCQU7mkH358J.
   Read it with the Artifact tool (`action: "read"`).
   The boards "Poster cabinet, more filmic" and "Festival tiers" are the reference.
7. `~/.codex/AGENTS.md`. Follow its code style: short lines, `const`, guards first,
   classes, multiline objects, PascalCase class files, kebab-case helper files.

Start the demo with the `laurels` entry in `.claude/launch.json` (preview_start).
Sign in on the mock sign-in page as Alex (owner). Sign in again as Sam (shared) for the viewer pages.

## 2. Goal

Every page must look like one film product: a festival programme, a trade paper and a cinema foyer.
Each page must do one job, with one name.
Each design choice must come from film or print practice, not from web-app habit.

The pages today:

| Page | Route | Its job |
|---|---|---|
| Sign in (title card) | `#/` when signed out | Sign in |
| Filmography (poster cabinet) | `#/user/<id>` | Show what one person won |
| Programme | `#/programme/<section>/<id>` | List every trophy, won and not won |
| Trophy detail | `#/trophy/<achievement>/<id>` | Explain one trophy |
| Box office | `#/box-office` | Rank the household |
| In the trades | `#/trades` | List new trophies by week |
| Year in film | `#/recap/<id>` | Sum up one person's year |
| Settings | `#/settings` | Connect the server, owner only |
| Unlock popup, Discord message | `UnlockPopup.js`, `DiscordNotifier.ts` | Announce new trophies |

## 3. One page for one job

### 3.1 Rules

1. Each page answers one question. Write the question at the top of your audit for each page.
2. One name for one thing. A name used for a page is not used for a section of a different page.
3. A page can show a short summary of a different page.
   The summary must use that page's name and end with a link to it ("All 47").
4. A filter exists in one place only.
5. The menu label, the page title, the browser tab title and the route say the same thing.
6. If two pages show the same data in the same way, merge them.

### 3.2 Known problems to fix

| Problem | Where |
|---|---|
| "Box office" names three things: the page, a list on the Filmography, and the household progress on the trophy page | `BoxOfficeView.js`, `CabinetView.js` line ~368, `TrophyView.js` line ~166 |
| "Now showing" has three meanings: the latest trophy, the popup label and the Year in film label | `CabinetView.js`, `UnlockPopup.js`, `RecapView.js` |
| The Filmography filter buttons (All, Film, TV, Rare and up) repeat the Programme tabs | `CabinetView.js` `filterButtons()` |
| Locked trophies show in three places: Coming soon, In production and the Programme "Not won" filter | `CabinetView.js`, `ProgrammeView.js` |
| The "In the trades" list on the Filmography has no link to its page | `CabinetView.js` `inTheTrades()` |
| Two routes do not match their labels: `#/recap` is Year in film, `#/user` is Filmography | `Dashboard.js` |

Find more of the same kind. Propose the fix for each, for example
"Coming soon on the Filmography shows the 4 closest only, with a link to the Programme".

## 4. Tone of voice

### 4.1 The voice

Laurels writes like the film trade: a festival programme, a trade paper and the end credits.
It is plain, short and exact. It never sells.

| Text | Model | Example |
|---|---|---|
| Headlines (In the trades, Discord) | Trade-paper headline: short, active, present tense | Alex takes Night shift |
| Trophy rules | Festival programme note: one plain sentence | Watch 25 horror films. |
| Facts and figures | End credits: label, then value | Earned with · Night of the Living Dead |
| Flavour lines | One narrator for all trophies | The lights stay on now. |
| Help and errors | ASD-STE100 Strict: one instruction in each sentence | Sign in with the account that owns the server. |
| Empty states | A slate or a programme note, never a joke | No trophies here yet. |

### 4.2 Rules

1. Write all text in ASD-STE100 style. Use Strict mode for help, errors and settings.
   Run `python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py` on each doc you change.
2. Use British spelling: colour, programme, favourite.
3. Use film words only if a viewer knows them: premiere, credits, box office, sequel, trailer,
   billing, programme. Do not use crew jargon such as "dailies" in help text.
4. Use one film word in a sentence, not three. No stacked puns.
5. No hype, no praise of the user and no exclamation marks.
   Not "You're crushing it!". Not "Amazing streak!".
6. Use real numbers and dates: "25 horror films", "2 Nov 2026". Not "lots of films", "recently".
7. Check the flavour lines in `achievements.json`. They must all use one narrator voice.
   PLAN.md section 4 says to pick the voice first (for example a tired cinema usher).
   List each line that breaks the voice and give a new line.

### 4.3 Glossary

Fix this list in the audit, then use each term with one meaning only:

| Term | One meaning |
|---|---|
| Filmography | The trophies one person won, as posters |
| Programme | The full list of trophies |
| Coming soon | Trophies not won yet |
| In production | The locked trophies nearest to done |
| Now showing | The newest trophy of one person |
| Premiere | A trophy that is new since your last visit |
| Box office | The household ranking |
| In the trades | New trophies in the household, by week |
| Year in film | One person's year |
| Laurel | The tier emblem |

Change the glossary if section 3 needs it. Then use the result everywhere: the menu, page titles, Discord, docs.

## 5. The Plex name

Plex is the name of a different company's product. Laurels must not look like a Plex product,
and must not suggest that Plex made or endorses it.

### 5.1 Keep the name only where a person needs it to act

| Keep | Why |
|---|---|
| The button "Sign in with Plex" | The person must know which account to use |
| The Settings field "Plex server address" and the token help | The person must find these values in Plex |
| Errors that name the Plex server, for example "Cannot reach the Plex server at …" | The person must know which system failed |
| One line in the README: "Laurels works with Plex Media Server." | Says what Laurels needs |
| Install and spike docs where a step happens inside Plex | The person must find the setting |
| Code names such as `PlexClient` and `PLEX_URL` | Not shown to people. Do not change. |

### 5.2 Remove or change it everywhere else

| Now | Change to |
|---|---|
| "A Plex household production" (sign-in title card) | "A household production" |
| "Reading Plex history now…", "Syncing with Plex…" | "Reading your watch history…" |
| "Time between checks of Plex (minutes)" | "Time between checks for new watches (minutes)" |
| "People who have access to the Plex server can see the trophies." | "People who share your server can see the trophies." |
| "Plex trophies", "Plex achievements" in any doc or board | "Laurels" or "trophies" |

Also:

1. Do not use the Plex logo, the Plex orange (`#e5a00d`) or Plex fonts anywhere.
2. Put one line in the README and on the Settings page:
   "Laurels is not made or endorsed by Plex, Inc."
3. Count the uses before and after:

   ```bash
   grep -n "Plex" public/index.html public/js/*.js
   ```

   Each line that stays must match a row in section 5.1.

## 6. Typography

Type does most of the work in film graphics. Fix type before colour or motion.

### 6.1 One role for each font

| Font | Role | Do not use it for |
|---|---|---|
| Source Serif 4 | Page titles, trophy names, large figures | Labels, buttons, tables |
| League Gothic | Billing lines, chart names, trade headlines, slate text | Body text, anything in lower case |
| Inter | Body text, rules, buttons, form fields | Titles of 32 px or more |
| IBM Plex Mono | Timecodes, counters, ranks in tables, dates in lists | Sentences |

Do not add a fifth font. IBM Plex Mono is a typeface name, not the Plex product. Keep it.

### 6.2 A type scale

`app.css` has 27 different font sizes today. Replace them with one scale of 8 sizes or fewer,
as tokens on `:root` (for example `--type-xs` to `--type-3xl`).
Then use only the tokens for `font-size`. This command must give no results when you finish:

```bash
grep -o "font-size: [0-9]*px" public/app.css | sort | uniq -c
```

### 6.3 Rules for type

1. Use caps only for labels, billing lines, headlines and the slate.
2. Add letter spacing only to caps: 0.06em to 0.16em.
3. Use tabular figures (`font-variant-numeric: tabular-nums`) for numbers in columns,
   counters, ranks, dates and timecodes.
4. Use real characters: “quotes”, ’apostrophes’, an en dash for ranges (2019–2026),
   a non-breaking space between a number and its unit.
5. Keep body text between 45 and 75 characters on a line.
6. Load only the weights that the CSS uses. Do not let the browser make fake bold or italic.
7. Align text to the left. Centre text only on the title card and on the slate.
8. Set a billing block in condensed caps with tight line height (1.1 or less).

## 7. Infographics

Read the `dataviz` skill before you change a chart.

1. One series gets one colour. Mark the most important value in gold and label it directly.
2. No legend for one series. No pie, donut, gauge or 3D charts.
3. Every number has a unit or a label. Every chart has a date range.
4. Bars start at zero. Numbers in tables are right-aligned, with tabular figures.
5. Prefer a small table or a bar in a row to a large chart.
6. Hide a percentage on a server with fewer than 5 people (`householdShare`). Show a count ("2 of 4").

## 8. Layout and design

1. One grid: a 1180 px column, 24 px gutters, 16 px on a phone.
2. A spacing scale of 4, 8, 12, 16, 24, 32 and 48 px, as tokens on `:root`.
3. Film aspect ratios: 2.39:1 for heroes, 2:3 for posters, 1.85:1 for wide panels.
4. Divide content with 1 px rules, as a trade paper does.
   Use a panel with a background only for the popup and for forms.
5. Posters keep a 3 to 4 px radius. Tables, rules and the letterbox keep 0.
6. One primary action on each screen at most.

## 9. Motion

1. Every movement has one job: show a change of state, show order, or give feedback.
2. Use only the motion tokens on `:root` (`--hover`, `--dissolve`, `--iris`, `--develop`,
   `--scrub`, `--ease-film`) and the moments in `public/js/helpers/motion.js`.
3. A cut is the default change. No bounce, overshoot, elastic or spring curves.
4. Add a new moment only if a film editor would name it: cut, dissolve, wipe, iris, match cut.
5. Animate one page only once per visit (`onceThisVisit`). Do not loop an animation.
6. With `prefers-reduced-motion: reduce`, every change is a cut.
7. No JavaScript animation library.

## 10. Things to remove (AI-isms)

Search for each item. Remove it or replace it with the film equivalent.

Structure:

- Two pages, sections or filters that do the same job. Sections with no clear question.
- A "dashboard" home that shows a little of everything.

Words:

- "unlock your", "journey", "seamless", "elevate", "magic", "awesome", "Oops!", "Let's".
- Exclamation marks. Questions to the reader in headings. Praise of the user.
- Two names for one thing (see the glossary).

Type:

- One font for everything, or more than 8 font sizes.
- Gradient, outlined or glowing text. Caps in body text. Letter spacing on lower case.
- Centred paragraphs. Emoji as bullets or icons. Proportional figures in tables.

Visual:

- Gradients, glass effects and blur panels. A large drop shadow on every card (use `--raised` only).
- Rounded corners on everything. Sparkles, confetti, trophy cups and generic line icons.
- Dashboard stat cards with a round avatar and a big number.
- Grey placeholder boxes. Use the slate (`slateHtml`).

Motion:

- Fade-up on scroll. Pulsing, glowing or shimmering elements. Hover scale of more than 2%.

## 11. Keep these

- The palette on `:root`. New values go in tokens. No colours in the JS files.
- Five laurels with star emblems, no numbers inside the laurel.
- Contrast of 4.5:1 or more for text. Focus rings on all controls.
- Touch targets of 44 px or more. No sideways scroll at 375 px.
- No new npm packages and no build step.
- All tests pass (`npm test`).

## 12. Steps

1. **Audit.** Visit each page at 1366 px and 375 px, as Alex and as Sam. Take a screenshot of each.
   - Write the question each page answers (section 3).
   - Make a site map: each page, each section on it, and the data it shows. Mark each repeat.
   - Make a type specimen: one temporary page with every text style in use. Do not commit it.
   - Collect every piece of interface text, Discord text and flavour line in one list.
   - Run the Plex count in section 5.2.
   - Write one table: page, problem, source for the fix (film, print or rule number), size (S, M, L).
2. **Plan.** Do structure first, then words, then type, layout, colour and motion.
   Show the site map, the glossary, the table and the plan to the user.
   Wait for approval before step 3.
3. **Build.** Change `public/`, `achievements.json`, `DiscordNotifier.ts` and the docs.
   Put new values in tokens. Put shared code in `public/js/helpers/`.
   If you change a route, keep the old route as a redirect.
4. **Check structure.** Draw the site map again. No section may repeat a different page.
5. **Check words.** Run the STE linter on the docs. Search the interface for each word in section 10.
   Run the Plex count again.
6. **Check type.** Make the type specimen again. Run the `grep` command in section 6.2.
7. **Check against the canvas.** Put each new screenshot next to its canvas board.
   Fix each difference that is not on purpose.
8. **Check motion.** Record each `animate()` call with its duration and curve.
   Check it again with reduced motion on.
9. **Run the tests.** Run `npm test` and `docker build -t laurels:dev .`.

## 13. Report

Give the user:

1. The site map, before and after.
2. The final glossary.
3. A before and after screenshot for each page, side by side.
4. The type specimen, before and after, and the final type scale.
5. The Plex count, before and after, with the reason for each line that stays.
6. Each flavour line you changed, before and after.
7. The table from step 1, with a "done" or "not done" column.
8. Each animation: what moves, why, how long, and its curve.
9. Anything you did not do, and the reason.

Do not report a page as finished if you did not take its screenshot.
