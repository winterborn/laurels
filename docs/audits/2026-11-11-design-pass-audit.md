# Design pass: audit and concepts

Date: 2026-11-11. Prompt: [docs/prompts/design-pass.md](../prompts/design-pass.md).
Steps 1 (audit) and 2 (concepts) are done. Step 3 waits for the user to choose a concept.

## 1. Balance

| Section | Trophies | Points | Epic or Legendary |
|---|---|---|---|
| Film | 18 | 930 | 3 |
| TV | 7 | 210 | 0 |
| Both | 6 | 245 | 1 |

- Film has **72%** of the film and TV trophies and **82%** of their points. The target is 40% to 60%.
- TV has no Epic or Legendary trophy.
- Sam watches mostly TV (60 episodes, 77 films) but holds 8 film trophies and 5 TV trophies.
- Year in film counts only films for "Top genre". Sam's 30 drama episodes in 2024 do not show.
- Film-only names: Filmography, Year in film, "Film programme", "in release since", "an Alex production".
- The flavour lines speak as a cinema usher. The voice has no place for a living room.

## 2. Site map

| Page | Question | Sections | Repeats |
|---|---|---|---|
| Filmography | What did this person win? | Header, Now showing, grid of all wins, Coming soon (4), Box office (summary), In the trades (summary) | **The grid of all wins is the Programme "Won" view as posters** |
| Programme | Which trophies are there? | Tabs, filters, sorts, list | — |
| Trophy | What is this trophy? | Facts, credits, In the house, Also showing | — |
| Box office | Who leads? | Chart, Neck and neck, Awards night | — |
| In the trades | What is new, week by week? | Weeks | — |
| Year in film | What did this person watch this year? | Totals, chart, top genre, highlights, winners | Winners grid repeats the person's wins for one year (fine: one year only) |

## 3. Components

| Idea | Components today | Problem |
|---|---|---|
| Progress bar | `scrubber`, `points-bar`, `completion` | 3 components for 1 idea |
| Stat | `totals`/`total`, `facts`/`fact`, `stats-strip` | 3 components for 1 idea |
| Row in a list | `side-row`, `credit`, `programme-row`, `production` | `production` is a leftover name, now used for household rows and the race |
| Label | `kicker`, `section-title`, `band-tier`, `billing`, `when`, `caption`, `help` | 7 label styles |
| Big title | `page-title`, `detail-title`, profile `h1`, feature `h2`, `title-card-name` | 5 title styles |

239 CSS rules. 26 inline styles in the JS files, almost all for the tier colour (allowed).

## 4. Type

27 text styles in 7 sizes (from product pass v3). The 4 font roles hold.
No change is needed before the concept is chosen.

## 5. Reference products

| Product | Pattern | Problem it solves | Do not copy |
|---|---|---|---|
| Letterboxd | Poster grid of every film watched, diary, star ratings, lists | "What have I watched?" | The poster wall of every title, the diary, green-orange-blue accents, star ratings |
| Xbox achievements | Square icon, title, rule, gamerscore, unlock toast | "What did I unlock in this game?" | The square icon tile, the gamerscore total as the hero, the "Achievement unlocked" toast |
| TrueAchievements | List rows with icon, rule, points, ratio and "% have it" bar | "Which are left, and how rare are they?" | The row with icon, ratio and % bar, the weighted score |
| Steam | Global % unlocked, progress bar for each game | "How far am I in this game?" | The per-game progress bar as the main view |
| Plex | Library shelves, posters, "Continue watching" | "What can I watch next?" | The Plex look, colours, logo and its library layout |

Today, Laurels uses the Letterboxd poster wall on the Filmography,
and the TrueAchievements row on the Programme.

## 6. Three concepts

### A. Awards season

**Idea:** each year is an awards season for the household, with Film and Television categories side by side,
as at a combined screen awards night.

| Today | Becomes |
|---|---|
| Filmography | **Awards** (one person): wins and nominations |
| Programme | **Ballot** (every award, by category) |
| Box office | **Ceremony** (the household ranking and the titles) |
| In the trades | **Press room** (new awards by week) |
| Year in film | **Season review** (one person's year) |

**Person page:** "Winner" at the top for the newest award. Then two equal shelves, **Film** and **Television**,
each with its newest 6 wins as laurelled posters and a link to the Ballot.
Then **Nominations**: the 2 nearest Film awards and the 2 nearest Television awards.

**Film and TV side by side:** the same card. The category word, Film or Television, is in the billing line.
A TV card adds a season ribbon.

**Not copied:** no wall of every win (only the newest 6 for each shelf), no gamerscore hero, no icon rows.
The Ballot is a nomination form, with a box that is marked when won, not a list of achievement rows.

**Risk:** "nomination" can suggest a vote. The help text must say that it means "near to done".

### B. The listings

**Idea:** Laurels prints a listings guide for the household, where films and episodes share one schedule,
and trophies are the "picks" in it.

| Today | Becomes |
|---|---|
| Filmography | **This week** (one person's listings) |
| Programme | **Guide** (every trophy, by time slot and by kind) |
| Box office | **Ratings** (the household, as overnight figures) |
| In the trades | **Bulletin** |
| Year in film | **Annual** |

**Person page:** a schedule by evening slot (early evening, prime time, late night), with film blocks and episode blocks.
Trophies show as starred picks on the block that earned them.

**Film and TV side by side:** a film is one long block, an episode is a short block. Both sit in the same grid.

**Not copied:** no poster wall and no achievement rows.

**Risk:** new components for the schedule, which is hard to read on a phone.
The poster and laurel direction from PLAN.md section 5 would change a lot.

### C. The archive

**Idea:** each person keeps an archive. Each win is an object on a shelf:
a film win is a sleeve, a TV win is a box-set spine. The full list is the archive's card index.

| Today | Becomes |
|---|---|
| Filmography | **Shelf** (one person) |
| Programme | **Index** (every trophy as an index card, stamped with the date when won) |
| Box office | **Standings** |
| In the trades | **New arrivals** |
| Year in film | **Annual report** |

**Person page:** the newest win pulled out, poster face forward. Then two shelves of spines, Films and Television,
coloured by tier. Then **On order**: the 4 nearest.

**Film and TV side by side:** a film is a slim sleeve, a TV win is a wider box-set spine with the season count.

**Not copied:** spines and index cards are neither a poster wall nor achievement rows.

**Risk:** spines show less poster art. The CSS must draw spines that read at phone size.

## 7. Scores

1 is poor, 5 is strong, against the principles in the prompt (section 4).

| Principle | A. Awards season | B. The listings | C. The archive |
|---|---|---|---|
| Original | 3 | 5 | 5 |
| Balanced | 5 | 5 | 4 |
| One job for each page | 5 | 4 | 5 |
| Linked | 4 | 4 | 4 |
| One system | 5 | 2 | 3 |
| Plain | 4 | 3 | 4 |
| Accessible | 5 | 3 | 4 |
| **Total** | **31** | **26** | **29** |

**Recommendation: A, Awards season.** It keeps the laurels, posters and type that work today,
and it gives film and TV equal categories with the least new code.
C is the most original. Choose it if the poster wall must go completely.
