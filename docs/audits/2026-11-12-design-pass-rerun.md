# Design pass: audit rerun

Date: 2026-11-12. Claude ran it again after the build of concept A.
This rerun checks the four findings of the first audit
([2026-11-11-design-pass-audit.md](2026-11-11-design-pass-audit.md)).
Source: `achievements/achievements.json` and the demo server (`npm run demo`).

## Status in one table

| Finding | Before | Now | Status |
|---|---|---|---|
| Film share of film and TV awards | 72% | 56% (18 of 32) | Fixed |
| Film share of film and TV points | 82% | 52% (930 of 1,790) | Fixed |
| TV Epic and Legendary awards | 0 | 3 Epic, 1 Legendary | Fixed |
| Top genre counts TV | No | Yes, by title | Fixed |
| Awards page repeats the full list | Yes | 6 newest per shelf | Fixed |
| Letterboxd poster wall | Yes | Two shelves of 6 | Fixed |
| TrueAchievements rows | Yes | Paper ballot | Fixed |
| One meter, one stat block | 3 and 3 | `meter` and `stat-row` | Fixed |
| 3 label and 3 title styles | 7 and 5 | `eyebrow`, `section-head`, `caption`. `display`, `page-title`, `card-title`. | Fixed |
| `production` class | Used | Now `household-row` | Fixed |

## 1. Balance: catalogue

| Category | Awards | Points | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|---|---|
| Film | 18 | 930 | 3 | 6 | 6 | 2 | 1 |
| Television | 14 | 860 | 1 | 6 | 3 | 3 | 1 |
| Screen | 6 | 245 | 2 | 1 | 2 | 1 | 0 |

All 38 awards have a citation that starts with "For".

## 2. Balance: people in the demo

| Person | Films | Episodes | Film awards | TV awards | Screen awards | Top genre 2026 |
|---|---|---|---|---|---|---|
| Alex | 231 | 54 | 12 | 5 | 3 | Comedy: 8 films |
| Sam | 77 | 60 | 8 | 5 | 3 | Comedy: 3 films |
| Frankie | 114 | 0 | 11 | 0 | 2 | Horror: 14 films |
| Jo | 47 | 1 | 7 | 1 | 0 | Comedy: 4 films |
| Tess | 0 | 58 | 0 | 4 | 2 | Drama: 1 show |
| Kit | 2 | 2 | 2 | 1 | 0 | Comedy: 1 film, 1 show |

## 3. New findings

1. **TV awards come slower for each watch.**
   Frankie gets 1 film award for about 10 films.
   Tess gets 1 TV award for about 15 episodes.
   An episode is shorter than a film, so for each hour TV is not slower.
   No change. Check it again with real data.
2. **The first audit said that Sam watches mostly TV.**
   The demo data now gives Sam 77 films and 60 episodes.
   The earlier claim may have counted hours, not watches.
   Sam's 8 film and 5 TV awards fit the counts.
3. **Top genre counts a show once.**
   Tess has 58 episodes, but the genre line says "1 show".
   This matches the rule "count titles", but it can look small.
   Suggestion: add the episode count, such as "Drama: 1 show, 58 episodes".
4. **Screen has no Legendary award.**
   This is by design. Film and Television each have one.

## 4. Checks after the build

- All 8 pages are 375 px wide on a phone, with no sideways scroll.
- On a phone, Tess (TV only) sees the Television shelf first.
- Frankie and Tess each see a full page. An empty shelf names the first award to win.
- Nominations show only awards that have started.
- Old links redirect, for example `#/filmography/6` to `#/awards/6`.
- The "Just announced" popup opens after a demo watch.
- `npm test`: 26 pass, with 4 new balance tests.
- `docker build -t laurels:dev .`: passes.
- STE lint on the changed docs: 0 findings.
