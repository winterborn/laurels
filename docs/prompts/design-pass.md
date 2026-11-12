# Design pass: one original product for film and TV

Use this prompt to start a senior design pass on Laurels.
Paste everything below the line into a new Claude Code session in the `laurels` folder.
This prompt replaces nothing. The product pass prompt (`docs/prompts/product-pass.md`) stays for polish.

---

## 1. Role and outcome

You are a principal product designer who also writes production front-end code.
You lead this pass from concept to shipped code.

At the end of the pass, Laurels must:

1. Have its own concept. It must not look or work like Letterboxd, Xbox achievements,
   TrueAchievements, Steam or Plex.
2. Treat film and TV as equals in names, trophies, layout and data.
3. Give each page one job. No two pages show the same thing in the same way.
4. Link every mention of a trophy, a person or a title to its page.
5. Use one design system: one name, one component and one token for each idea.

## 2. The product today

Laurels gives trophies to the people in one household for what they watch on Plex.
Each trophy uses the poster of the title that earned it. Five tiers use laurels with star emblems.

| Page | Route | Job today |
|---|---|---|
| Filmography | `#/filmography/<id>` | Newest trophy, all trophies won as posters, 4 nearest trophies, short Box office and In the trades lists |
| Programme | `#/programme/<section>/<id>` | Every trophy as a list, with tabs (Film, TV, Film and TV, All), filters and sorts |
| Trophy detail | `#/trophy/<achievement>/<id>` | One trophy: facts, the watches that counted, the household, related trophies |
| Box office | `#/box-office` | Household ranking, closest race, household titles |
| In the trades | `#/trades` | New trophies by week |
| Year in film | `#/year-in-film/<id>` | One person's year |
| Settings | `#/settings` | Server, schedule, Discord, household, sign-in, demo (owner only) |
| Sign in | `#/` when signed out | Title card and Plex sign-in |
| Unlock popup | any page | Premieres since your last visit |

Known problems. Check each one in your audit:

1. **Filmography and Programme overlap.** The posters on the Filmography are the same trophies
   as the Programme "Won" filter. The difference is only the presentation.
2. **Film outweighs TV.**
   - The P1 catalogue has 18 film trophies, 7 TV and 6 for both. The full plan has 42, 29 and 18.
   - The names are film words: Filmography, Year in film, "in release since", "an Alex production".
   - The flavour lines speak as a cinema usher. A person who watches only TV at home has no place in that voice.
3. **The layout borrows from other products.**
   - The poster grid and the film diary feel come from Letterboxd.
   - The achievement list rows (icon, title, rule, points, "% have it" bar) come from Xbox and TrueAchievements.
   - The points total works like a gamerscore.

## 3. Read first

1. `PLAN.md`, sections 3 to 7: the rule engine, the catalogue, the design direction and the phases.
2. `achievements/achievements.json`: names, rules, tiers and flavour lines.
3. `public/app.css`: the tokens for colour, type, spacing and motion are on `:root`.
4. `public/js/*.js` and `public/js/helpers/*.js`: one View class for each page.
5. `docs/audits/2026-11-11-product-pass-v3.md`: the last audit, with its glossary.
6. The design canvas: https://claude.ai/artifact/Vgq24dxz6WJCQU7mkH358J (Artifact tool, `action: "read"`).
7. `~/.codex/AGENTS.md`: the code style. Short lines, `const`, guards first, classes,
   multiline objects, PascalCase class files, kebab-case helper files, tidy barrels.

Start the demo with the `laurels` entry in `.claude/launch.json`.
Do your browser work in a new tab at `http://127.0.0.1:8484`, so the user's own tab and session stay as they are.
Sign in on the mock page as Alex (owner, mostly films) and as Sam (shared, mostly TV).

## 4. Principles

Apply these to every decision. If two principles conflict, the earlier one wins.

1. **Original.** Study other products for problems they solve, never for their look.
   A reviewer who knows Letterboxd, Xbox and TrueAchievements must not recognise any screen.
2. **Balanced.** A person who watches only TV must feel as much at home as a person who watches only films.
3. **One job for each page.** Each page answers one question. Each piece of data has one home.
   Other pages show a short summary of it and link to that home.
4. **Linked.** Each trophy, person, title and summary links to its page.
5. **One system.** One name, one component and one token for each idea.
6. **Plain.** Write in ASD-STE100. Use British spelling. No hype and no exclamation marks.
7. **Accessible.** Contrast of 4.5:1 or more, focus rings, 44 px touch targets,
   no sideways scroll at 375 px, reduced motion respected.

## 5. Workstreams

### 5.1 Concept and originality

1. List what each reference product does. Use a table with these columns: product, pattern, the problem it solves, and "do not copy" (the look).
   Cover Letterboxd, Xbox achievements, TrueAchievements, Steam and Plex.
2. Write 3 concepts that put film and TV under one idea that is Laurels' own.
   For each concept, give:
   - the one-sentence idea
   - the names of the main pages
   - how one person's page looks, in a short sketch
   - how a film trophy and a TV trophy look side by side
   - one risk
   Example directions, not answers:
   - a festival season that covers the screen of every kind
   - an awards shelf that grows over the years
   - a broadcast schedule with features and episodes in one listing
3. Score each concept from 1 to 5 against the principles in section 4. Show the table.
4. **Stop. Show the 3 concepts to the user. Wait for the user to choose before you plan.**

### 5.2 Information architecture and linking

1. Make a site map: each page, its question, its sections, and the data each section shows.
   Mark each repeat.
2. Decide the relation of the person page (now Filmography) and the full list (now Programme).
   Choose one of these and give the reason:
   - **Two jobs:** the person page tells their story (newest win, highlights, what is next).
     The list is the reference (every trophy, filters, sorts). No full grid of wins on the person page.
   - **One page, two views:** one page with a "story" view and a "list" view, and one set of filters.
3. The main menu has 5 items or fewer. Settings and the account go at the side.
4. Linking rules:
   - Each summary ends with a link to its home page.
   - Each trophy name, poster or laurel links to the trophy page.
   - Each person name links to the person page.
   - Each title (film or show) shows its name. Plex owns the title page, so do not link titles to Plex.
   - Each page below the top level has a breadcrumb.
5. Routes: one route for each page, named like its menu label. Old routes redirect.

### 5.3 Film and TV balance

1. Set a target. Count trophies and points by section (film, TV, both).
   The film share and the TV share must each be between 40% and 60% of the trophies that are not "both".
   Propose new TV trophies or merges to reach it. Use only data that Plex gives (see PLAN.md section 2).
2. Rename each page and section that names only film.
   Test each name with one question: "Does a person who watches only TV understand it?"
   Keep film words only for film-only trophies.
3. Give TV the same visual weight:
   - a show poster with a season or episode tag, as large as a film poster
   - TV figures (episodes, seasons, shows) next to film figures, in the same style, everywhere a total shows
   - the year page counts films and episodes with equal weight
4. Write the flavour voice so that it fits a cinema and a living room. Rewrite each line that does not fit both.
5. Add two mock people, one who watches only films and one who watches only TV, in `dev/mock-plex/`.
   Each page must look complete for both of them.

### 5.4 Naming and voice

1. Make one glossary: each term, its one meaning, where it shows, and the film and TV test.
2. Use the same name in the menu, the page title, the browser tab, the route and the docs.
3. Write all text in ASD-STE100. Use Strict mode for help, errors and settings.
   Run `python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py` on each changed doc.
4. The Plex name stays only where a person needs it to act (sign-in, server address, token help, errors).
   Keep the line "Laurels is not made or endorsed by Plex, Inc." in the README and Settings.

### 5.5 Design system and conformity

1. List each component in use. For example: page header, section head, poster card, list row,
   laurel, slate, stat, bar, filter, link, button, popup.
   For each one, give one definition, its class name and the views that use it.
2. Merge components that do the same job. Remove the ones that are not used.
3. Use tokens only for colour, type, spacing, radius, shadow and motion.
   Use an inline style only for data, for example the tier colour or a bar width.
4. Class names: one name for one component, kebab-case, named for what it is, not how it looks.
5. Put shared HTML builders in `public/js/helpers/`, not inside a View class.

### 5.6 Typography

1. Keep the 4 font roles:
   - Source Serif 4: titles and large figures
   - League Gothic: billing, headlines, ranks and slate text, in caps
   - Inter: body text and controls
   - IBM Plex Mono: timecodes and counters
2. Use only the `--type-*` tokens. This command must give no results:
   `grep -o "font-size: [0-9]*px" public/app.css`.
3. Use caps only for labels, billing and headlines. Use tabular figures for all numbers.
   Use real quotes and dashes. Body lines are 45 to 75 characters long.
4. Make a type specimen of every text style in use, before and after. Do not commit it.

### 5.7 Layout and spacing

1. One grid: a 1180 px column, with 24 px gutters (16 px on a phone).
2. Rhythm: 48 px between page sections (32 px on a phone), 32 px between groups,
   12 px between a title and its line. Use the `--space-*` tokens only.
3. No negative margins, except where one element must overlap another on purpose.
   Write the reason in a comment.
4. Measure the gaps between sections on each page. They must match the rhythm.

### 5.8 Motion

1. Keep the edit grammar in `public/js/helpers/motion.js`.
   It has a cut by default, an iris and a dissolve for premieres,
   a developing poster, and bars that run once for each visit.
2. Use only the motion tokens. No bounce, no spring and no loop.
3. With reduced motion on, every change is a cut.

## 6. Process and gates

| Step | Do | Gate |
|---|---|---|
| 1. Audit | Screenshots of each page at 1366 px and 375 px, as Alex and as Sam. The site map, the component list, the type specimen, the glossary and the balance counts. | None |
| 2. Concept | 3 concepts with scores (section 5.1) | **The user chooses one** |
| 3. Plan | Changes by workstream, in this order: architecture, balance, naming, system, type, layout, motion. Each change gets a size (S, M or L). | **The user approves** |
| 4. Build | Small commits of work by workstream. Update the canvas boards that show changed pages. | None |
| 5. Check | The checks in section 7 | None |
| 6. Report | Section 8 | None |

Do not start a step before the user passes the gate above it.

## 7. Acceptance checks

1. The site map shows no repeat. Each summary links to its home page.
2. The balance counts are within the target in section 5.3.
3. The film-only person and the TV-only person each see complete pages.
4. A recognition check: for each page, name the reference product that it looks most like, and why it is now different.
5. Each name passes the TV test, or it is a film-only trophy.
6. The `grep` command in section 5.6 gives no results. The type specimen uses only the 4 roles.
7. The gaps between sections match the rhythm in section 5.7, at 1366 px and 375 px.
8. Every page is 375 px wide on a phone.
9. The STE linter finds no problems in the changed docs, other than quoted text.
10. `npm test` passes and `docker build -t laurels:dev .` succeeds.

## 8. Report

Give the user:

1. The chosen concept, in one paragraph, and the 2 that you did not choose, in one line each.
2. The site map and the glossary, before and after.
3. The balance counts, before and after.
4. A before and after screenshot of each page, for a film person and a TV person.
5. The component list, before and after.
6. The results of the checks in section 7.
7. What you did not do, and why.

## 9. Out of scope

- New data sources (session recorder, Tautulli import). They are in PLAN.md phase 2.
- Email, yearly recap changes beyond naming, and new rule types.
- Any change to the sign-in or the security rules.
