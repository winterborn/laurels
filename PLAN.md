# Laurels — Plan

Achievements and trophies for films and TV watched on Plex.
Modelled on [yxqzme2/achievement-engine](https://github.com/yxqzme2/achievement-engine)
(Audiobookshelf), with its weak spots fixed.

Name: **Laurels** (chosen 2026-11-11, was "Plex Trophies").
No "Plex" in the name: it is Plex's trademark.
Folder: `laurels`. Date: 2026-11-03.

---

## 1. What the reference repo does

Two services, polling every 5 minutes:

```
Audiobookshelf ──▶ abs-stats (Node, :3000) ──▶ achievement-engine (Python/FastAPI, :8000)
                   aggregates ABS API           evaluates rules, SQLite, dashboards
```

Core loop (`app/main.py` `run_once`):

1. Pull every user's full history (finished books, sessions, series).
2. Run ~12 evaluators over the **whole history** each cycle.
3. Each evaluator returns `(achievement, payload)` with a `_timestamp`.
4. `INSERT` into `awards (user_id, achievement_id)` primary key.
   Duplicates bounce off the key, so the loop is idempotent.
5. New rows → Discord embed + SMTP email.

Good ideas worth keeping:

- **Full recompute, idempotent insert.** No incremental state to corrupt.
- **Backdating.** Award time = when the Nth event happened,
  not when the engine noticed. Fresh installs get a real history.
- **Definitions in one JSON file**, hot-reloaded each cycle.
- **Rarity + points**, leaderboard, timeline, per-user progress.

Weak spots to avoid:

| Reference repo | Problem | Our fix |
|---|---|---|
| Rules are English text parsed by regex (`"Finish 5 books total."`) | Wording breaks rules; needs a separate tester page | Structured `rule` object + JSON Schema |
| Two services (Node proxy + Python engine) | Two images, two configs | One TypeScript service |
| Timezone hardcoded `America/New_York` | Wrong streaks elsewhere | `TZ` config |
| HTTP call per award to fetch a title | Slow, flaky | Local metadata cache |
| 143 icon PNGs (56–60px) picked from World of Warcraft's icon set, one `iconPath` per achievement | Blizzard copyright; not themed to books, just well chosen | The Plex poster of the item that earned it (section 5) |
| No dashboard auth | Exposes viewing history | Sign in with Plex: owner and shared-user roles |

---

## 2. Data sources

Three sources, one normalised model. Plex alone is enough for the MVP.

### Plex Media Server (required)

Owner token (`X-Plex-Token`). Sees every account on the server.

| Need | Endpoint |
|---|---|
| Watch history, all users | `GET /status/sessions/history/all` (`accountID`, `viewedAt>`, `sort=viewedAt:desc`, `X-Plex-Container-Start/Size`) |
| Users | `GET /accounts` |
| Libraries | `GET /library/sections` |
| Item metadata | `GET /library/metadata/{ratingKey}?includeGuids=1` (Genre, Director, Role, Studio, Country, year, contentRating, duration, imdb/tmdb/tvdb GUIDs) |
| Show/season episode counts | `leafCount` on show and season |
| Collections | `GET /library/sections/{id}/collections` |
| Posters | `GET /photo/:/transcode` (proxied, token never sent to browser) |
| Live sessions | `GET /status/sessions` |

Limits:

- History holds **scrobbles only** (watched ≥ 90%).
  No start time, no pause, no partial watches.
  `viewedAt` is roughly the end time.
- Watch time is estimated from item `duration`.
- Removed media leaves history rows with thin metadata.
  Cache metadata the first time an item is seen; keep it forever.

### Session recorder (ours, phase 2)

Plex history has no sessions, so we record them the way Tautulli does.
Read from Tautulli's source, commit `463b427` (2026-11-02):
`plexpy/web_socket.py`, `activity_handler.py`, `activity_pinger.py`,
`activity_processor.py`, `helpers.py`, `config.py`.

**Connection**

1. Open `ws(s)://PLEX/:/websockets/notifications`,
   owner token in the `X-Plex-Token` header.
   Tautulli has no Plex Pass check anywhere on this path.
2. Keep only `type: "playing"`. Its `PlaySessionStateNotification[0]`
   carries `sessionKey`, `ratingKey`, `key`, `state`
   (`playing` / `paused` / `buffering` / `stopped` / `error`)
   and `viewOffset` (ms). Plex sends one roughly every 10 seconds.
   Other types (`progress`, `transcodeSession.update`) are dropped.
3. Socket closed: retry 5 times, 5 seconds apart.
   Still down: try again every 30 seconds.
   There is **no polling of sessions** while it is down.
4. On every (re)connect, read `GET /status/sessions` once and
   reconcile: a stored session no longer playing is stopped and written.

**One row per live session**

| Event | What happens |
|---|---|
| New `sessionKey` (not `buffering`) | Read `/status/sessions` for user, player, platform, item; `started = now` |
| `paused` | `last_paused = now` |
| `playing` after a pause | `paused_counter += now - last_paused` |
| `stopped` | Final `viewOffset` (set to full length if within 10s of the end), write history |
| Different `ratingKey` on the same `sessionKey` | Stop the old item, start the new one |
| No event for 5 minutes | Force stop and write history |
| While playing | `stopped` refreshed every 60s, so a crash keeps a near-true end time |

**Writing history**

- Play time = `stopped - started - paused_counter` (seconds).
- Films and episodes under **120 seconds** of play time are not logged.
- Watched = `viewOffset >= 85%` of duration (films and TV, both 85),
  same as Tautulli, so recorder rows and Tautulli imports agree.
  Optional rule: credits marker instead of percent.
- A later session of the same item by the same user, starting at or after
  where the last one stopped, links to it (`reference_id`).
  So a film watched in two goes counts as one watch.

**Limits**

- Only knows sessions from the day it starts, and only while it runs.
  Older history stays Plex scrobbles, or comes from a Tautulli import.
- Tautulli records nothing while the socket is down.
  On drop, every live session's `stopped` is set to that moment;
  on reconnect, any no longer playing are written with that time.
  Its `check_active_sessions` runs only on reconnect, not on a timer.
- Our one addition: while the socket is down, read
  `GET /status/sessions` every 30 seconds and feed the same handler.
  It changes no rule. It only catches plays Tautulli would lose.

Nothing in this path is private to Tautulli.
It uses only the owner token, the websocket and `/status/sessions`.
So Tautulli is not needed to run Laurels.

P0 checks: the socket delivers other users' sessions to the owner token;
`/status/sessions` gives `User id` and `Player platform`.

### Tautulli (optional import, phase 3)

Not needed. Import only if the server already runs it.
Same sessions as our recorder,
but going back to the day Tautulli was installed.
Tautulli never reads Plex's own history, so it has nothing older.
Gain: session detail for the years before our recorder started.
That matters only for the (S) trophies (section 4).

`get_history` rows include `started`, `stopped`, `paused_counter`,
`play_duration`, `percent_complete`, `watched_status`, `user_id`,
`rating_key`, `grandparent_rating_key`, `media_type`, `platform`,
`player`, `transcode_decision`, `guid`, `year`. Paged by `start`/`length`.

Unlocks: accurate time-of-day, real hours, binge windows,
watch parties (overlapping sessions), device achievements.

### Plex webhooks (optional, phase 3)

Needs Plex Pass on the server owner. `media.scrobble` fires at 90%.
Used only as a "re-evaluate now" poke, never as the source of truth,
because events are lost when the engine is down
and they stop silently if Plex Pass lapses.

### Normalised model

```ts
interface WatchEvent {
    userId: string;
    ratingKey: string;
    kind: 'movie' | 'episode';
    showKey?: string;
    seasonKey?: string;
    watchedAt: number;      // epoch seconds
    startedAt?: number;     // sessions only
    playSeconds?: number;   // sessions, else item duration
    pausedSeconds?: number; // sessions only
    platform?: string;      // sessions only
    source: 'plex' | 'recorder' | 'tautulli';
}
```

Items cache: title, year, duration, genres, directors, top-billed cast,
studio, country, contentRating, originallyAvailableAt, guids,
leafCount (shows/seasons), collection ids.

Session rows (recorder, then Tautulli) win over Plex rows, as in Tautulli.
A Plex row is the same watch as a session row when user and item match
and `viewedAt` falls between `started` and `stopped + 10 min`.
Plex rows count only where no session covers them
(before the recorder started, or while it was off).

---

## 3. Rule engine

Rules are data, not sentences. The text is for display only.

```json
{
    "id": "genre_horror_25",
    "title": "Night Shift",
    "description": "Watch 25 horror films.",
    "flavorText": "The lights stay on now.",
    "rarity": "Rare",
    "points": 50,
    "rule": {
        "type": "count",
        "filter": {
            "kind": "movie",
            "genre": "Horror"
        },
        "distinct": true,
        "target": 25
    }
}
```

Seven rule types cover almost every idea in section 4:

| Type | Meaning | Backdate to |
|---|---|---|
| `count` | N watches matching a filter (distinct or not) | Nth matching watch |
| `hours` | N hours matching a filter | watch that crossed the line |
| `complete` | Every item in a set watched (show, season, collection, curated list) | last missing item |
| `streak` | N consecutive days / weeks with a watch | last day of streak |
| `window` | N matching watches inside a time window (day, 24h, weekend, month, year) | Nth watch in window |
| `social` | Same item as another user within N days, or overlapping sessions | later of the two |
| `meta` | N achievements or N points earned | the award that crossed it |

Filter fields: `kind`, `genre`, `decade`, `yearBefore`, `yearAfter`,
`director`, `actor`, `studio`, `country`, `contentRating`,
`durationMin`, `durationMax`, `hourFrom`, `hourTo`, `weekday`,
`titleContains`, `rewatch`, `releaseWithinDays`, `listId`, `platform`.

Each evaluator is a pure function:
`(events, items, rule) → { earned, at, progress, target }`.
`progress` feeds the "next up" bars for free.

JSON Schema validates the file at load.
Bad entries are logged and skipped, never crash the loop.
This replaces the reference repo's `achievement-tester.html`.

---

## 4. Catalogue (89)

Named after film and TV trade terms. Every one maps to data we have.
(S) needs session data (our recorder, or a Tautulli import).
(R) needs Plex critic ratings.

Each trophy shows the frame from the watch that earned it (section 5).
Show and season trophies use the frame from the last episode.

**Built in P1 (2026-11-12): 38 awards.** Film 18, Television 14, Screen 6
(Screen counts film and TV together). Film has 56% of the Film and
Television awards and 52% of their points. A test checks that neither
side goes over 60%. The design pass added 7 TV awards: Long runner,
Network veteran, Test card, Showrunner, Syndication deal, Pilot season
and Prime time. Every award has a citation that starts with "For".
The lists below are the long-term catalogue.

### Film (42)

| Trophy | Level | Earned by |
|---|---|---|
| Fade in | Common | Your first film |
| Regular | Common | 10 films |
| Season ticket | Uncommon | 50 films |
| That's a wrap | Rare | 100 films |
| Projectionist | Epic | 250 films |
| Film buff | Epic | 500 films |
| Fade out | Legendary | 1,000 films |
| Opening week | Rare | A film within 7 days of release |
| Double feature | Uncommon | 2 films in one evening |
| Marathon | Epic | 4 films in one day |
| Dailies | Rare | A film every day for 7 days |
| Matinee idol | Uncommon | 10 films started before noon |
| Midnight movie | Uncommon | Start a film between midnight and 00:30 (S) |
| Director's cut | Rare | A film over 3 hours |
| Short and sweet | Common | 10 films under 90 minutes |
| Again | Uncommon | The same film 3 times |
| Stayed for the credits | Uncommon | Watch 10 films right to the end (S) |
| Walkout | Common | Give up on a film before 25% (S) |
| Auteur theory | Uncommon | 5 films by one director |
| Typecast | Uncommon | 10 films with the same actor |
| Studio system | Rare | 20 films from one studio |
| Silent era | Rare | A film from before 1930 |
| Cinephile | Rare | Films from 6 different decades |
| Subtitles on | Uncommon | 10 non-English films |
| World cinema | Rare | Films from 10 countries |
| Sequelitis | Uncommon | 10 sequels |
| Trilogy | Uncommon | 3 films from one collection |
| Franchise player | Rare | Finish a whole Plex collection |
| Archivist | Epic | Finish 10 collections |
| Remake | Rare | Two films with the same title from different years |
| Certified fresh | Rare | 25 films critics scored 90%+ (R) |
| Guilty pleasure | Uncommon | 10 films critics scored under 30% (R) |
| Award season | Rare | 10 Best Picture winners |
| Academy member | Legendary | Every Best Picture winner |
| Night shift | Rare | 25 horror films |
| Laugh riot | Rare | 25 comedies |
| Deep space | Rare | 25 science-fiction films |
| Meet cute | Rare | 25 romances |
| Edge of your seat | Rare | 25 thrillers |
| Frame by frame | Rare | 25 animated films |
| Fly on the wall | Rare | 25 documentaries |
| Saddle sore | Rare | 25 westerns |

### TV (29)

| Trophy | Level | Earned by |
|---|---|---|
| Pilot | Common | Your first episode |
| Season pass | Uncommon | 100 episodes |
| Long runner | Rare | 500 episodes |
| Network veteran | Epic | 1,000 episodes |
| Test card | Legendary | 5,000 episodes |
| Box set | Rare | Finish a whole show |
| Season finale | Uncommon | Finish 10 seasons |
| Showrunner | Epic | Finish 10 shows |
| Network executive | Epic | Finish 25 shows |
| Lifetime achievement | Legendary | Finish 50 shows |
| Syndication deal | Epic | 100 episodes of one show |
| Institution | Legendary | Finish a show with 10+ seasons |
| Cancelled too soon | Uncommon | Finish a show with only one season |
| Jumped the shark | Rare | Watch season 8 or later of a show |
| Pilot season | Uncommon | Episode 1 of 10 different shows |
| Renewed | Uncommon | Start season 2 within 7 days of finishing season 1 |
| Binge mode | Uncommon | 6 episodes of one show in 24 hours |
| Season in a day | Epic | A whole season in one day |
| Couch potato | Rare | 12 episodes in one day |
| Sweeps week | Rare | 20 episodes in one week |
| Channel hopper | Uncommon | 5 different shows in one day |
| Prime time | Uncommon | 50 episodes started between 8 and 10pm |
| Graveyard slot | Uncommon | 10 episodes after 2am |
| Water-cooler moment | Rare | An episode within 24 hours of it airing |
| Previously on… | Common | Return to a show after 6 months away |
| Left on a cliffhanger | Uncommon | Finish a season, then wait 30+ days for the next |
| Two-parter | Uncommon | "Part 1" and "Part 2" on the same day |
| Christmas special | Uncommon | A Christmas episode in December |
| Laugh track | Uncommon | 25 comedy episodes under 35 minutes |

### Both (18)

| Trophy | Level | Earned by |
|---|---|---|
| Night owl | Common | 10 watches after 1am |
| Weeklong run | Common | Watch something 7 days in a row |
| Held over | Rare | 30 days in a row |
| Long run | Legendary | 100 days in a row |
| Season subscriber | Epic | Something every week for a year |
| Running time | Uncommon | 100 hours watched |
| Blockbuster | Rare | 500 hours |
| Box office legend | Epic | 1,000 hours |
| Hall of fame | Legendary | 5,000 hours |
| Shared screen | Uncommon | Same film as a friend within 7 days |
| Table read | Uncommon | Same episode as a friend within 24 hours |
| Word of mouth | Uncommon | Watch a film a friend finished first |
| Premiere party | Rare | Watch the same thing at the same time as a friend (S) |
| Ratings war | Rare | You and a friend finish the same show in one month |
| Supporting role | Uncommon | Earn 10 trophies |
| Leading role | Rare | Earn 25 trophies |
| Top billing | Epic | 1,000 points |
| Clean sweep | Legendary | Earn every trophy |

Engine additions these need: filters `criticRating`, `percent`,
`seasonIndex`, `episodeIndex`, `month`; two rule types
`gap` (time between watches: Previously on, Cliffhanger, Renewed)
and `pair` (two matching items: Remake, Two-parter).
Add them in P2 with the rest of the catalogue.

### Borrowed from the reference repo (2026-11-03)

1. **House trophies.** The reference names trophies after its owner's
   favourite series. Ours: `achievements/house.json`, same format,
   loaded beside the standard set. Typical rule: `complete` over a
   Plex collection or a GUID list ("Every Bond film", "All of Frasier").
   Shown in their own "House" shelf. P2.
2. **One narrator voice.** Every reference line is spoken by "The System".
   Ours: one voice for all `flavorText`, picked before writing
   (a tired cinema usher, or a studio memo). Write all 89 in it. P2.
3. **Calendar-year trophies.** `window` with `"window": "year"`:
   - Year in film: 100 films in one calendar year.
   - 52 weeks: a film in every week of one calendar year
     (`streak` in weeks, reset on 1 January).
   - Yearly recap page per user. P3.
4. **Single sitting.** A sitting is back-to-back sessions
   with gaps under 10 minutes and pauses under 10 minutes.
   New rule type `sitting` with `targetMinutes`.
   "No intermission": a 4-hour sitting. Needs session data. P2.
5. **Title words.** `titleContains` filter, already in section 3.
   "Night after night": 5 films with "Night" in the title.
   "Dead serious": 5 with "Dead". P2.
6. **Spreadsheet authoring.** The reference ships `AchBuilder.csv`.
   Ours: `npm run import-csv house.csv` writes `house.json`,
   one row per trophy, columns for each rule field.
   Bad rows are reported by row number and column, nothing written. P3.
7. **Easy install.**
   - `setup.sh` asks for Plex URL and token, tests them,
     writes `.env`.
   - `EMAIL_TO_OVERRIDE`: every email goes to one address (testing).
   - `SEND_TEST_ALERT=1`: sends one sample award to each notifier
     on start. P3.

---

## 5. Artwork

### What TrueAchievements shows (checked 2026-11-03)

Looked at Halo Infinite's achievement list and one achievement page.

- **Icon:** square, **64×64**, 5px rounded corners.
  Even the single-achievement page only serves 64px.
  The list loads icons from one vertical sprite sheet
  (64×3200, 50 icons per sheet).
- **Art style:** one centred emblem on a dark vignette.
  Harder versions reuse the **same emblem with more effect**
  (plain skull → skull in blue flame; plain object → object in fire).
  The whole game shares one visual family.
- **Row layout:** icon, title, one-line description, points,
  a bar for "% of tracked players who have it",
  a weighted score (TA ratio), guide count, flag icons (DLC etc.).
- **Game header:** wide banner art, totals
  (score, points, count), est. time to complete.

Can't reuse any of it:

- The art belongs to the game publishers; TrueAchievements only hosts it.
- The site blocks scripted access (HTTP 403, Cloudflare challenge),
  so no scraping. Use it as a **style reference only**.

### Styles surveyed (TrueAchievements, 27 Xbox sets, 2026-11-03)

| Family | Examples | Fit for us |
|---|---|---|
| Pictogram / signage | Alan Wake 2, Portal 2, Untitled Goose Game, Max Payne 3, Starfield | Best. Reads at 44px, jokes via pose |
| Recurring mascot | Fallout 4 (one cartoon man), Goose, Cuphead coins | Strong personality, same figure every time |
| Numeral series | Return of the Obra Dinn (I–X), Halo 3 (I–IX) | Good for count ladders |
| Framed object cards | Pentiment, Hades, Tunic, Inscryption, Persona 5 | Needs a real illustrator |
| Medals | Mass Effect, Halo MCC | Military tone, wrong for films |
| Screenshots | Sea of Thieves, Forza, Gears, Stray, Celeste | Not possible; we have no game world |

What the good sets share, and our earlier mocks lacked:

- **One rigid system.** Fixed palette, stroke weight, angle and framing.
  Every icon obviously belongs to the set.
- **One subject, big.** Readable as a silhouette at 44px.
- **The joke is in the pose,** not in added detail.
- **No render tricks.** No gradients, glow, bloom, sparkles or chrome.
  Texture, if any, comes from print (flat ink, paper).

What made ours look AI-made: glossy rings and glow on everything,
stock symbols (reel, TV, ticket) with no story, and every badge
using the same template with different clip art.

### Chosen direction: filmic poster cabinet (2026-11-11)

> **Changed 2026-11-12: concept A, Awards season.** Each year is an awards
> season for the household. Pages: **Awards** (Winner, a Film shelf and a
> Television shelf side by side, a Screen row, Nominations), **Ballot**
> (every award on one paper ballot in three columns), **Ceremony** (the
> standings, Closest race, Special awards), **Press room** (new awards by
> week) and **Season review** (films and episodes by month, side by side).
> The popup says "Just announced". The flavour line is a **citation**.
> The names below (Filmography, Coming soon, Now showing, Box office,
> In the trades, Premiere, scrubber) are the old ones. Plan and audit:
> [docs/audits/2026-11-12-design-pass-plan.md](docs/audits/2026-11-12-design-pass-plan.md).

Letterboxd's way of designing, with modern film language on top.
Own name, colours and type; no Letterboxd logo or branding.

- **The poster is the art.** Each trophy shows the Plex poster of the
  film or show that earned it. TV trophies use the show poster plus a
  season or episode tag (`S2 · E1–E6`, `ALL 4 SEASONS`) top left.
  Nothing is drawn per trophy, and no artwork ships with the app.
- **Tier = festival laurel.** A laurel in the tier metal, top right,
  with a tier emblem inside (no number, changed 2026-11-11), a 2px frame
  in the same metal, and the laurel word in the bottom band above the
  trophy name. The emblem grows with the tier, like the Halo difficulty
  icons: 1 star, 2 stars, 3 stars, a star in a ring, a star in a ring
  with rays. The points show in the "Now showing" line and in the
  laurel's tooltip.

  | Tier | Laurel word | Metal | Emblem | Points |
  |---|---|---|---|---|
  | Common | Official selection | bronze `#d29a66` | 1 star | 10 |
  | Uncommon | Special mention | silver `#c9d1d9` | 2 stars | 25 |
  | Rare | Winner | gold `#e3b04b` | 3 stars | 50 |
  | Epic | Grand prize | rose gold `#ef8a76` | star in a ring | 100 |
  | Legendary | Lifetime achievement | platinum `#bfe6ff` | star in a ring with rays | 250 |

  Tier is always shown by metal and word, never by colour alone.
- **Locked = "Coming soon".** The poster of the nearest qualifying film,
  grey and dimmed, with a slanted "COMING SOON" band and the progress.
  **Secret = "Under wraps"**, no poster.
- **Latest trophy = "Now showing".** A 2.39:1 letterboxed backdrop
  (Plex `art`) with a teal and warm colour grade, the date in the top
  bar, the flavour text as a subtitle, the poster overlapping it.
- **Progress = a playback scrubber** with timecode-style counts.
- **Section names:** Filmography (cabinet), Coming soon, In production
  (next up), Box office (leaderboard), In the trades (activity, written
  as trade headlines), Highlights reel, Awards night.
- **Look.** Ground `#14181c`, panels `#1a2026`, rules `#2c3440`,
  text `#dde6ed`, muted `#9aabb8`. Inter for UI, Source Serif 4 for
  names and headings, League Gothic for billing blocks and laurels,
  IBM Plex Mono for timecodes.
- **Unlock.** Popup "Now showing · Winner" with the framed poster.
  Several at once collapse into one "3 premieres while you were away".
  Discord: a card for Rare and up, one plain line for smaller trophies.

Pages mocked on the canvas: filmography (desktop and phone), trophy
detail, Box office, year-in-film recap, unlock popup and Discord message,
festival tiers. Sample data, public-domain posters from Wikimedia Commons,
and three stand-in posters for made-up shows.

Canvas: [Plex Trophies achievement designs](https://claude.ai/artifact/Vgq24dxz6WJCQU7mkH358J).
The illustrator brief is no longer needed: posters replace drawn art.

Rejected on the way, in order: glow medals, line icons with puns, struck
metal medals on velvet, silent-era frames with intertitles, console
badges, duotone cards, big-number cards, widescreen-only, laurel posters
alone, clapperboard slates. Laurels and widescreen survive inside the
chosen direction.

### Rarity display

TrueAchievements-style:

- Show "% of users on this server who have it" under each trophy.
- Hide it below 5 users; a 2-person household makes it noise.
  The definition's `rarity` stays the source of truth.

---

## 6. Architecture

One service. Node 24, TypeScript, built-in `node:sqlite`.

```
Plex PMS ─┐
Tautulli ─┼─▶ Sources ─▶ SQLite (events, items, awards) ─▶ RuleEngine ─▶ Notifiers
webhook ──┘                                │                               (Discord, SMTP)
                                           └─▶ HTTP: API + static dashboard
```

Cycle (every `POLL_SECONDS`, default 300, or on webhook):

1. Sync users.
2. Sync history since last `viewedAt` (first run: everything).
3. Fetch metadata for unseen `ratingKey`s.
4. Rebuild per-user event lists, evaluate every rule.
5. Insert awards (PK `user_id, achievement_id`), notify new ones.

Notify only awards dated after install
(or within `NOTIFY_BACKFILL_DAYS`) so first run does not spam 300 embeds.

Tables:

- `events` — normalised `WatchEvent`, unique on source key.
- `items` — metadata cache JSON + `fetched_at`.
- `users` — id, name, avatar, alias.
- `awards` — user, achievement, `awarded_at`, payload JSON.
- `sync_state` — cursors per source.

API (mirrors the reference repo):

- `GET /api/definitions`, `/api/awards`, `/api/progress`, `/api/users`
- `GET /api/poster/:ratingKey` (proxy)
- `POST /hooks/plex` (multipart webhook)
- `GET /health`

UI: plain HTML + one script, no framework.
Pages: trophy cabinet per user, leaderboard, timeline, "next up".
Trophy art: the Plex poster of the item that earned it, with the tier
laurel, metal frame and name band (section 5).

Layout (PascalCase class files, kebab-case for helpers):

```
laurels/
  achievements/achievements.json
  achievements/lists/*.json          # curated GUID lists
  public/                            # dashboard
  src/main/
    sources/PlexSource.ts
    sources/SessionRecorder.ts       # websocket + /status/sessions
    sources/TautulliSource.ts
    store/Store.ts
    rules/RuleEngine.ts
    rules/evaluators/*.ts            # one per rule type
    notify/DiscordNotifier.ts
    notify/SmtpNotifier.ts
    http/Server.ts
    Config.ts
    main.ts
  Dockerfile
  docker-compose.yml
```

Config (env): `PLEX_URL`, `PLEX_TOKEN`, `TAUTULLI_URL`, `TAUTULLI_KEY`,
`TZ`, `POLL_SECONDS`, `DISCORD_WEBHOOK_URL`, `SMTP_*`,
`USER_ALIASES`, `ALLOWED_USERS`, `DASHBOARD_PASSWORD`.

---

## 7. Phases

**P0 — Spike (½ day).** Run guide and decision table:
[SPIKE.md](SPIKE.md). Code in `spike/` (Node 24, read-only).
Four runs against the real server: `collect`, `listen`,
and `mark-check` before and after marking an episode watched.
Answers 20 questions: account coverage, paging, history size,
devices, removed media, every metadata field a trophy needs,
artwork, websocket sessions, mark-as-watched, Plex Pass, Tautulli.

Exit: the `findings.md` files are in, and each answer is recorded below
under "P0 findings" with any decision it changes.

P0 findings: _not run yet._

**P1 — MVP.** Plex source, store, rule types
`count` / `hours` / `complete` / `streak` / `window`,
~25 achievements, Discord notifier, cabinet + progress page,
poster cabinet with laurels (section 5),
Dockerfile. Exit: real backdated awards for every user on your server.

P1 build status (2026-11-11):

- Done and tested against the mock Plex server (`npm run demo`):
  Plex sync, SQLite store, the five P1 rule types, 31 achievements,
  backdated awards, Discord notifier, poster cabinet and Box office page.
- Unit tests: 9 rule tests pass (`npm test`).
- Settings page with "Sign in with Plex" (plex.tv PIN flow), server picker,
  Test connection and Send test message. Saved in `/config/settings.json`;
  an environment variable locks its field. Replaces `setup.sh`.
- Docker: `Dockerfile`, `docker-compose.yml`, PUID/PGID entrypoint,
  health check. Guide: [docs/install.md](docs/install.md).
  Built and run on Docker Desktop against the mock Plex server.
- Login: Sign in with Plex. The owner gets settings, shared users can view,
  other accounts are refused. Optional guest view on the home network,
  `AUTH=off` for proxies with their own login. 30-day sessions in SQLite.
  Tested against a mock plex.tv (`dev/mock-plex/MockPlexTv.ts`).
- Pages from the design (2026-11-11): trophy detail with "The credits",
  Box office (podium, chart, Neck and neck, Awards night, time ranges),
  Year in film (totals, watches by month, top genre, Highlights reel),
  In the trades, and the unlock popup (new since your last visit).
  Discord message as in the Unlock board, with one summary message
  when a person gets 4 or more trophies in one sync.
- Aligned with the reference project: `/api/awards` and `/api/progress`,
  `achievements.json` read again when it changes, household share
  (hidden below 5 people). Routes: [docs/api.md](docs/api.md).
- Tests: 22 pass (rules, catalogue reload, helpers, sign-in roles, API).
- Product pass (2026-11-11, prompt in [docs/prompts/product-pass.md](docs/prompts/product-pass.md)):
  motion tokens and edit grammar (cut by default, iris and dissolve on the
  unlock popup, the new poster develops, scrubbers run once per page per
  visit, all off with reduced motion), Plex backdrops with duotone and grain
  for "Now showing" (poster fallback), a trade-paper Box office (TW, LM, ▲▼,
  one-colour points bar), clapperboard slates for cards with no poster,
  In the trades by week, a sign-in title card, a phone stats strip.
- Programme (2026-11-11): every trophy in one list, as on TrueAchievements,
  with Film, TV, Film and TV, and All tabs. Each row has the laurel tile,
  the poster when won, title, rule, points, "2 of 4 have it" with a bar,
  and your status. Grouped by laurel, or sorted by rarest, points or recent.
- Product pass v3 (2026-11-11, audit in docs/audits/): one page for one job
  (Filmography without filters, one Coming soon, "In the house", "Premiere"),
  routes `#/filmography` and `#/year-in-film`, the night usher's flavour lines,
  the Plex name only where people need it, 8-step type scale and spacing tokens.
  The trophy popup now opens on any page (checked every minute), Settings has
  "Check now", and the demo has "Add a winning watch".
- Design pass (2026-11-12, concept A, Awards season): the five pages above,
  routes `#/awards`, `#/ballot`, `#/award`, `#/ceremony`, `#/press-room` and
  `#/season`, with redirects from all old routes. 7 new TV awards, two
  demo people (Frankie watches only films, Tess only TV), genres counted by
  title for films and shows. One `meter`, one `stat-row`, three label and
  three title styles. Rerun: [docs/audits/2026-11-12-design-pass-rerun.md](docs/audits/2026-11-12-design-pass-rerun.md).
- Not yet: a run on your server, a sign-in with a real Plex account,
  a real Discord message, a published image.
- Laurels are drawn in the browser (`public/js/Laurel.js`), not SVG files.
- The mock server lives in `dev/mock-plex/`, test use only.

**P2 — Rich data.** Session recorder (with polling fallback), de-dup,
`social` + `meta` + `sitting`, time-of-day exact, curated lists,
house trophies, narrator voice, remaining catalogue.

**P3 — Polish.** Optional Tautulli import, webhook trigger,
leaderboard, timeline, yearly recap,
SMTP, CSV import, `setup.sh`, test alerts,
Unraid template, README.

**Later, only if asked.** Jellyfin/Emby source (same `WatchEvent`),
Trakt import for pre-Plex history, TMDB episode counts
for "complete" on shows you only partly own.

Checks: one test file per evaluator with fixture events,
asserting `earned`, `at` (backdate) and `progress`.

---

## 8. Risks and open questions

- **Partial libraries.** "Complete a show" means every episode
  *in your library*. Default to that; TMDB counts in "later".
- **Manual marks.** If marking watched writes history, P0 decides
  whether to ignore Plex-only rows for big trophies.
- **Removed media.** Metadata must be cached before deletion,
  so first sync fetches metadata for the whole history.
- **Privacy.** Dashboard shows what everyone watched.
  Opt-in per user via `ALLOWED_USERS`; hide titles of
  restricted content ratings by default.
- **Plex API is not formally versioned.** Keep all Plex calls in
  `PlexSource.ts`, record a fixture, test against it.

Decisions taken (change before P1 if wrong):

1. TypeScript single service, not the Python + Node split.
2. Plex-only MVP. Our own session recorder in P2.
   Tautulli is not needed. Optional import in P3, only for older sessions.
3. Polling is the source of truth; webhooks only poke.
4. Discord first, email in P3.
