# Design pass: plan for concept A, Awards season

Date: 2026-11-12. The user chose concept A on 2026-11-12.
Audit and concepts: [2026-11-11-design-pass-audit.md](2026-11-11-design-pass-audit.md).
Mock-up: canvas board "Concept A: Awards season".
The user approved the plan on 2026-11-12. Claude built it on the same day.
Check: [2026-11-12-design-pass-rerun.md](2026-11-12-design-pass-rerun.md).

## The concept in one paragraph

Each year is an awards season for the household. Every trophy is an award in one of three categories:
**Film**, **Television** and **Screen** (both). Each person has an Awards page with two equal shelves, Film and Television,
and a Screen row below them. The Ballot lists every award as a paper ballot, with a mark for each win.
The Ceremony ranks the household. The Press room announces new awards. The Season review sums up one person's year.

## 1. Architecture (S = small, M = medium, L = large)

| # | Change | Size |
|---|---|---|
| 1.1 | Menu: **Awards · Ballot · Ceremony · Press room · Season review** (5 items). Settings and the account stay at the side. | S |
| 1.2 | Routes: `#/awards/<id>`, `#/ballot/<id>`, `#/ceremony`, `#/press-room`, `#/season/<id>/<year>`, `#/award/<achievement>/<id>`. All old routes (`#/filmography`, `#/user`, `#/programme`, `#/box-office`, `#/trades`, `#/year-in-film`, `#/recap`, `#/trophy`) redirect. | S |
| 1.3 | **Awards page** (was Filmography): "Winner" panel for the newest award. Then the **Film** and **Television** shelves side by side, each with its newest 6 wins and a link "All film awards on the Ballot". Then a **Screen** row of up to 6. Then **Nominations**: up to 2 nearest in each category. No full wall of wins: the Ballot is the full list. | M |
| 1.4 | The shelf that the person uses more comes first on a phone (more episodes than films: Television first). | S |
| 1.5 | **Ballot** (was Programme): one paper ballot with three columns: Best in Film, Best in Television, Best on Screen. Each row has a box (✕ when won), the award, its rule, its laurel and the date or progress. One filter only: All, Won, Not yet. No sort buttons, no "% have it" bars. | M |
| 1.6 | The household line on each ballot row names people, not a percentage: "Won by Alex and Sam". This replaces the TrueAchievements-style bar. | S |
| 1.7 | **Ceremony** (was Box office): the standings table stays. "Neck and neck" becomes **Closest race**. "Awards night" becomes **Special awards**. | S |
| 1.8 | **Press room** (was In the trades): the weekly list stays. Each headline names the category: "Sam wins Couch potato (Television)". | S |
| 1.9 | **Season review** (was Year in film): totals for films and episodes, side by side. **Two small charts**, Film watches and Television watches by month, each in one colour. The top genre counts films and shows. | M |
| 1.10 | **Award page** (was Trophy): the category word on the poster and in the kicker. "In the house" becomes **Household**. | S |

## 2. Film and TV balance

| # | Change | Size |
|---|---|---|
| 2.1 | Category names everywhere: Film, Television, Screen. The Ballot and shelves use the same three. | S |
| 2.2 | Add 7 TV awards that today's rules support. See the list below the table. | M |
| 2.3 | Result: 18 Film, 14 Television, 6 Screen. Film is 56% of the Film and Television awards and 52% of their points. Television gets 3 Epic awards and 1 Legendary award. | — |
| 2.4 | Add two mock people: **Frankie** (films only) and **Tess** (television only). Each page must look complete for both. | M |

The 7 new TV awards:

| Award | Tier | Rule |
|---|---|---|
| Long runner | Rare | 500 episodes |
| Network veteran | Epic | 1,000 episodes |
| Test card | Legendary | 5,000 episodes |
| Showrunner | Epic | Finish 10 shows |
| Syndication deal | Epic | 100 episodes of one show |
| Pilot season | Uncommon | Episode 1 of 10 shows |
| Prime time | Uncommon | 50 episodes started 20:00 to 22:00 |

## 3. Naming and voice

| Old | New | Why |
|---|---|---|
| Filmography | Awards | Works for film and TV |
| Programme | Ballot | The concept |
| Box office | Ceremony | Box office is a film word |
| In the trades | Press room | Works for both |
| Year in film | Season review | Works for both |
| Trophy | Award | The concept |
| Now showing | Winner | The newest award |
| Coming soon | Nominations | The nearest awards |
| Premiere (popup) | Just announced | Works for both, and fits the ceremony |
| Flavour line | Citation | The concept |

Citations replace the night usher. A citation is the line a presenter reads for an award.
It starts with "For" and fits film and TV. Examples:

| Award | Citation |
|---|---|
| Night shift | For leaving the lights on, 25 times. |
| Box set | For every episode, without a gap. |
| Graveyard slot | For the hours when nobody else is up. |
| Running time | For a hundred hours in the dark. |

All 38 awards get a citation. The tier words stay: Official selection, Special mention, Winner, Grand prize, Lifetime achievement.

## 4. Design system

| # | Change | Size |
|---|---|---|
| 4.1 | One progress component, `meter`, replaces `scrubber`, `points-bar` and `completion`. | M |
| 4.2 | One stat component, `stat-row`, replaces `totals`, `facts` and `stats-strip`. | S |
| 4.3 | Three label styles: `eyebrow`, `section-head` and `caption`. They replace 7 label styles. | M |
| 4.4 | Three title styles: `display`, `page-title` and `card-title`. They replace 5. | S |
| 4.5 | New components: `shelf` and `ballot`. Rename `production` to `household-row`. Remove the CSS for things that no longer exist (podium, programme rows, filters on the person page). | M |
| 4.6 | New tokens for the ballot paper: `--paper` and `--ink-on-paper`. | S |

## 5. Type, layout and motion

| # | Change | Size |
|---|---|---|
| 5.1 | No new fonts or sizes. The Ballot uses Inter and IBM Plex Mono on paper. Category headings use League Gothic. | S |
| 5.2 | Keep the rhythm: 48 px between sections (32 px on a phone), 32 px between groups. | S |
| 5.3 | Motion: keep the edit grammar. The "Just announced" popup keeps the iris and the developing poster. No new moments. | S |

## 6. Also update

- The canvas boards that show the changed pages.
- README, `docs/install.md` and `docs/api.md` for the new names and routes.
- PLAN.md section 5 for the concept, and section 4 for the new awards.
- The tests for the new awards and the redirects.

## 7. Build order

1. Architecture and routes (1.1, 1.2, 1.10)
2. Balance: awards, categories and mock people (2.1, 2.2, 2.4)
3. Awards page, Ballot, Season review (1.3 to 1.6, 1.9)
4. Ceremony and Press room (1.7, 1.8)
5. Names and citations (section 3)
6. Design system clean-up (section 4)
7. Checks (prompt section 7), canvas and docs
