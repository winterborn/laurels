# Product pass v3: audit and plan

Date: 2026-11-11. Prompt: [docs/prompts/product-pass.md](../prompts/product-pass.md) version 3.
Checked as Alex (owner) and Sam (shared), at 1366 px and 375 px, against the mock server.
Built on 2026-11-11. Section 9 has the results.

## 1. The question each page answers

| Page | Question |
|---|---|
| Sign in | How do I get in? |
| Filmography | What did this person win? |
| Programme | Which trophies are there, and which does this person still need? |
| Trophy detail | What is this trophy, and how did it happen? |
| Box office | Who leads the household? |
| In the trades | What did the household win, week by week? |
| Year in film | What did this person watch this year? |
| Settings | How do I connect the server? (owner only) |

## 2. Site map: sections and repeats

| Page | Section | Data | Repeat of |
|---|---|---|---|
| Filmography | Header (billing line) | Totals, rank | Box office (fine: a summary) |
| Filmography | Now showing | Newest trophy | — |
| Filmography | Filmography grid + filters (All, Film, TV, Rare and up) | Won trophies | **Programme tabs and "Won" filter** |
| Filmography | Coming soon (all 11 to 15 locked) | Locked trophies | **Programme "Not won"** |
| Filmography | In production (5 nearest) | Nearest locked | **Coming soon, a third time** |
| Filmography | Box office (side list) | Household ranking | Box office page. **No link.** |
| Filmography | In the trades (side list, 8) | Newest trophies | In the trades page. **No link.** |
| Programme | Tabs, filters, sorts, list | All trophies | — |
| Trophy detail | **"Box office"** | Household progress on this trophy | **Same name as the Box office page** |
| Trophy detail | Credits, Also showing | — | — |
| Box office | Chart, Neck and neck, Awards night | Ranking | — |
| In the trades | Weekly list | All trophies by week | — |
| Year in film | Kicker **"Now showing · 1 January to…"** | — | **"Now showing" means the newest trophy elsewhere** |
| Unlock popup | Kicker **"Now showing · Winner"** | New trophies | **Same** |

Routes: `#/user/<id>` is the Filmography and `#/recap/<id>` is Year in film. The names do not match.

## 3. Glossary (proposed)

| Term | One meaning | Change |
|---|---|---|
| Filmography | Posters of the trophies one person won. No filters. | Remove its filters |
| Programme | The full list of trophies. The only place with filters and sorting. | — |
| Coming soon | The 4 locked trophies nearest to done, on the Filmography, with a link to the Programme | Merges "Coming soon" and "In production" |
| Now showing | The newest trophy of one person. Filmography only. | Removed from the popup and Year in film |
| Premiere | A trophy that is new since your last visit | The popup says "Premiere · Winner" |
| Box office | The household ranking | — |
| In the house | Household progress on one trophy | New. Replaces "Box office" on the trophy page. |
| In the trades | New trophies in the household, by week | — |
| Year in film | One person's year | Route becomes `#/year-in-film/<id>` |
| Laurel | The tier emblem | — |
| In production | — | **Removed** |

## 4. Type specimen

46 text styles use 21 sizes.
The sizes are 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 21, 22, 24, 26, 28, 30, 34, 40, 44, 48 and 52 px.
The four font roles are mostly right. Problems:

| Problem | Where | Fix |
|---|---|---|
| 21 sizes | All pages | Scale of 8: 11, 13, 15, 19, 26, 40, 52, 64 px as `--type-*` tokens |
| Text at 9 and 10 px | Poster band tier word, slate labels, TV tag | 11 px at least |
| The "Now showing" quote is Inter. The trophy page quote is Source Serif italic. | Filmography, trophy page | Source Serif italic for every flavour line |
| Poster band names are Inter 800 in caps | Poster cards | League Gothic (a billing role) |
| Numbers in tables use proportional Inter | Box office "Trophies", Programme points | Tabular figures |
| "3..." is three full stops | Binge mode flavour line | One ellipsis character, or a new line |

## 5. Words

### 5.1 Voice of the flavour lines

The 31 lines use four voices: commands ("Bring sandwiches."), an usher ("They know your seat."),
narration ("The cushion has your shape.") and stock phrases ("Time well spent.", "Just one more.").
"Held over for a year." repeats the name of a different trophy.
"Every episode in the library." repeats the rule.

Proposed voice: **the night usher**. First person, dry, kind, present tense, 8 words or fewer.
The usher sees you at every showing and says so.

| Trophy | Now | Proposed |
|---|---|---|
| Fade in | Lights down. Here we go. | First one’s always the best seat. |
| Regular | They know your seat. | I know your seat by now. |
| Season ticket | Same time next week. | I keep your row free. |
| That's a wrap | Strike the set. | A hundred. I stopped counting at fifty. |
| Projectionist | You could thread it blindfold. | You could run the booth yourself. |
| Fade out | Roll credits. | A thousand films. I’ll get the lights. |
| Double feature | Stay for the second picture. | Second picture starts in five. |
| Marathon | Bring sandwiches. | I’ve swept round you twice. |
| Dailies | Review the footage. | Seven nights. I kept the stubs. |
| Matinee idol | Popcorn for breakfast. | Morning showings are quiet. I like that. |
| Director's cut | Nothing was left on the floor. | I checked my watch. Twice. |
| Short and sweet | In and out. | Out before the popcorn’s cold. |
| Again | It gets better every time. | Same film again? I won’t tell. |
| Auteur theory | You know the signature. | You know their films by the first shot. |
| Typecast | Always the same face. | Same face on every poster you pick. |
| Silent era | Mind the intertitles. | No talking. You’re good at that. |
| Night shift | The lights stay on now. | I leave the lights on for you now. |
| Laugh riot | Hold the front row. | I can hear you from the foyer. |
| Pilot | Previously on: nothing. | First episode. I’ll save your seat. |
| Season pass | See you next week. | A hundred episodes. Same seat. |
| Box set | Every episode in the library. | Every episode. I checked the shelf. |
| Season finale | Same time next year. | See you next season. |
| Binge mode | Next episode in 5, 4, 3... | I stopped asking if you’re staying. |
| Couch potato | The cushion has your shape. | I brought you a cushion. |
| Graveyard slot | Nobody else is up. | Just you and me at this hour. |
| Night owl | Just one more. | Last showing again? I’ll lock up. |
| Weeklong run | A full week on the bill. | Seven nights. Same row. |
| Held over | By popular demand. | Thirty nights. The seat is yours now. |
| Running time | Time well spent. | A hundred hours in the dark. |
| Blockbuster | Queues round the block. | Five hundred hours. You’ve worn the armrest. |
| Box office legend | Held over for a year. | A thousand hours. I’ll put up a plaque. |

### 5.2 Other text

No banned words, no exclamation marks and no praise of the user in the interface or the Discord text.

## 6. The Plex name

21 interface strings use the name. 6 server messages use it. The README uses it 9 times.

| Keep (a person needs it to act) | Change |
|---|---|
| "Sign in with Plex" (sign-in page, Settings) | "A Plex household production" → "A household production" |
| "Plex server" panel title, "Plex token" field and its help | "Reading Plex history now…" → "Reading your watch history…" |
| "Waiting for you to sign in to Plex…" | "Saved. Syncing with Plex…" → "Saved. Reading your watch history…" |
| "Plex opens in a new window. Laurels does not see your Plex password." | "Time between checks of Plex (minutes)" → "Time between checks for new watches (minutes)" |
| Errors: "… has no access to this Plex server", "Cannot reach Plex at …" | "People who have access to the Plex server can see…" (2 places) → "People who share your server can see…" |
| "If Plex is on the same Docker network…" (address help) | "Select your Plex server below" → "Select your server below" |
| "Connected to Mock Plex (Plex 1.41)" (names the version) | "Laurels has a Plex token." → "Laurels is connected." |
| Code names (`PlexClient`, `PLEX_URL`) | "Write the Plex account id…" → "Write the account id…" |

Add: "Laurels is not made or endorsed by Plex, Inc." in the README and at the foot of Settings.
No Plex logo, orange or fonts are in use today.

## 7. Problems and fixes

| # | Area | Problem | Fix | Source | Size |
|---|---|---|---|---|---|
| 1 | Structure | Filmography filters repeat the Programme | Remove them | Rule 3.1.4 | S |
| 2 | Structure | Locked trophies in 3 places | One "Coming soon": 4 nearest, poster and bar, link "Full programme" | Rule 3.1.6 | M |
| 3 | Structure | "Box office" on the trophy page | Rename "In the house" | Rule 3.1.2 | S |
| 4 | Structure | "Now showing" has 3 meanings | Popup: "Premiere". Year in film: no kicker word. | Rule 3.1.2 | S |
| 5 | Structure | Side lists do not link to their pages | "Full chart", "All 47" links | Rule 3.1.3 | S |
| 6 | Structure | Routes do not match labels | `#/filmography/<id>`, `#/year-in-film/<id>`. Old routes redirect. | Rule 3.1.5 | S |
| 7 | Layout | Programme on a phone: filters and sorts take 3 rows before the list | One row each, scrolling inside the row | Trade-paper contents strip | S |
| 8 | Bug? | Programme completion bar on a phone looked almost empty at 71% | Find and fix | — | S |
| 9 | Words | Flavour lines in 4 voices | The night usher (table 5.1) | Rule 4.2.7 | M |
| 10 | Words | Plex name in brand and status text | Table 6 | Section 5 | S |
| 11 | Type | 21 sizes | 8-step scale, tokens only | Section 6.2 | M |
| 12 | Type | 9 and 10 px text | 11 px at least | Legibility | S |
| 13 | Type | Quote fonts differ | Source Serif italic | One role per font | S |
| 14 | Type | Poster band names in Inter caps | League Gothic | One-sheet billing | S |
| 15 | Type | Proportional numbers in tables | Tabular figures | Section 6.3.3 | S |
| 16 | Layout | No spacing scale | 4 to 48 px tokens | Section 8.2 | M |

No colour or motion problems found. The motion from the last pass meets section 9.

## 8. Plan

1. **Structure:** items 1 to 6 and 8.
2. **Words:** items 9 and 10, plus the README and Settings disclaimer.
3. **Type:** items 11 to 15.
4. **Layout:** items 7 and 16.
5. **Checks:** site map, specimen, Plex count, canvas comparison, motion record, tests and Docker build.

## 9. Results (built 2026-11-11)

| # | Done | Note |
|---|---|---|
| 1 | Done | Filmography has no filters. A "Programme" link replaces them. |
| 2 | Done | One "Coming soon": the 4 nearest, each with a bar, and "All 12 not won" |
| 3 | Done | Trophy page: "In the house" |
| 4 | Done | Popup: "Premiere · Winner". Year in film: date range only. |
| 5 | Done | "Full chart" and "All 46" links |
| 6 | Done | `#/filmography/<id>`, `#/year-in-film/<id>`. `#/user` and `#/recap` redirect. |
| 7 | Done | One scrolling row for filters, one for sorts |
| 8 | Not a bug | The bar was mid-animation in the screenshot. It fills 72%. |
| 9 | Done | All 31 flavour lines in the night usher's voice |
| 10 | Done | Plex name: 21 strings → 13, each a kept use. Disclaimer in README and Settings. |
| 11 | Done | 7 sizes in use (8 tokens). No `font-size` in px. |
| 12 | Done | Smallest text is 11 px |
| 13 | Done | Every quote in Source Serif italic |
| 14 | Done | Poster band names in League Gothic |
| 15 | Done | Tabular figures on the whole page |
| 16 | Done | Spacing tokens `--space-1` to `--space-7` |

Also built: the premiere check on every page, at start, every minute and after "Check now".
Settings has "Check now", and the demo has an "Add a winning watch" button.

Type specimen: 46 styles in 21 sizes before, 27 styles in 7 sizes after.
Phone width: all 8 pages are 375 px wide.
