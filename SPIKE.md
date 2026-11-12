# Laurels: server check (P0 spike)

Before you use Laurels on your real Plex server, run this check.
It shows what your server sends.
Each answer keeps or changes a decision in [PLAN.md](PLAN.md).

- **Time:** about half a day. Most of the time, you wait while something plays.
- **Changes:** the check only reads data (HTTP GET and one websocket).
  The only change to Plex is one **Mark as watched** in step 4.
  You do it by hand, and then you undo it.
- **Privacy:** all output stays on your computer.
  Send back only the `findings.md` files.
  They contain counts, yes or no answers, library names and account ids.
  They do not contain film titles or the names of people.
  Keep `raw/` and `images/` private. They contain your watch history and pictures.

---

## 1. Prepare

1. **Node.js 24.** Run `node -v` to see the version. With nvm, run `nvm use 24`.
2. **Owner token.** Use the token of the account that owns the server.
   The token of a different account cannot see the history of all accounts.
   1. In Plex Web, sign in as the owner and open a film.
   2. Select `⋯`, then **Get Info**, then **View XML**.
   3. A new tab opens. Its address ends with `X-Plex-Token=...`. Copy that value.
3. **Server address.** Use the LAN IP address and plain `http`,
   for example `http://192.168.1.10:32400`.
   Then you get no certificate errors.
4. **Settings file.** In the `laurels` folder, run:

   ```bash
   cp spike/.env.example spike/.env
   ```

   Then write your values for `PLEX_URL` and `PLEX_TOKEN` in `spike/.env`.
5. **Tautulli (optional).** If you use Tautulli, add `TAUTULLI_URL` and `TAUTULLI_KEY`.
   The key is in Tautulli, in **Settings**, **Web Interface**, **API key**.

---

## 2. Collect (one run, 1 to 10 minutes)

```bash
node --env-file=spike/.env spike/main.ts collect
```

This run reads:

- The server version, Plex Pass status, accounts, devices, libraries and counts.
- **All** watch history of all accounts, 1,000 rows on each page.
- All metadata for 40 films and 40 episodes, from the newest watch to the oldest.
  It also reads about 10 of their shows and some seasons.
- 8 pictures through the Plex image resizer.
- The sessions that play now.
- The Tautulli version, the history size and the oldest session, if you set Tautulli.

To change the number of films and episodes, set `SPIKE_SAMPLE=80` in `spike/.env`.

---

## 3. Listen (15 minutes, with a second person or device)

```bash
node --env-file=spike/.env spike/main.ts listen 15
```

Wait for the line `Socket open`. Then, while the run continues:

1. **A different account** plays an episode for about 3 minutes.
   This can be a Plex Home user or a person that you share the server with.
2. That person **pauses** for 1 minute, **resumes** for 1 minute and then **stops**.
3. **The owner account** plays a film for about 2 minutes and then stops.

The check writes one line for each event.
Press Ctrl+C to stop early. The check still saves the output.
For a longer run, use `listen 60`.

---

## 4. Mark-as-watched check (5 minutes)

1. Select an episode that **nobody watched**.
2. Find its `ratingKey`. Select **Get Info**, then **View XML**.
   The address contains `/library/metadata/12345`. The number is the key.
3. Run the first check:

   ```bash
   node --env-file=spike/.env spike/main.ts mark-check 12345
   ```

4. In Plex, select **Mark as watched** for that episode. Wait 1 minute.
5. Run the same command `mark-check 12345` again.
6. In Plex, select **Mark as unwatched**.

---

## 5. Send back

Each run makes a folder in `spike-output/`:

```
spike-output/2026-11-04T10-00-00-000-collect/
  findings.md     <- send this file
  raw/*.json      <- keep private: full history, names, metadata
  images/*.jpg    <- keep private: pictures from your library
```

Send the `findings.md` files from collect, listen and **both** mark-check runs.

Each row in `findings.md` has a result:

| Result | Meaning |
|---|---|
| `ok` | The answer is as the plan expects. |
| `check` | Look at this row. |
| `fail` | This row stops part of the plan. |

---

## 6. What each answer decides

| # | Question | Row in findings | If yes | If no |
|---|---|---|---|---|
| 1 | The owner token sees the history of every account | History: accounts with history, accounts with none | No change | An account with no history can be a person who never watches. If a person who watches is not in the list, Plex gives history per user, and P1 changes. |
| 2 | Paging returns all history | History: Paging | No change | Page by `viewedAt`, not by offset |
| 3 | How large and how old the history is | History: oldest, per year, rows | Sets the first-run time and `NOTIFY_BACKFILL_DAYS` | Not applicable |
| 4 | History rows have a device | History: deviceID found in /devices | Device trophies use history only | Device trophies need the recorder (P2) |
| 5 | Old watches are still in the library | Metadata: no longer in library | No change | If more than 10% are missing, label genre trophies "from what is still in your library" |
| 6 | Films have genre, director, cast, country, studio and GUIDs | Film metadata: each field | The trophy stays | If a field is on less than 90% of films, remove the trophy or label it "best effort" |
| 7 | Films have critic scores with a known source | Film metadata: criticRating, rating source | (R) trophies use that source | Remove Certified fresh and Guilty pleasure |
| 8 | Items have credits markers | Film and Episode: creditsMarker | Stayed for the credits uses the marker | Use 99% of the running time |
| 9 | Films have an audio language | Film metadata: audioLanguage | Subtitles on uses it | Use the country |
| 10 | Libraries have collections | Libraries: collections | Trilogy, Franchise player and Archivist stay | Use curated GUID lists only |
| 11 | Shows and seasons have episode counts | Show and Season: episodeCount | Box set, Season finale and Institution stay | Get the counts from TMDB |
| 12 | Items have release and air dates | releaseDate, airDate | Opening week and Water-cooler moment stay | Remove them |
| 13 | Pictures come through the Plex image resizer | Artwork rows | Posters show in Laurels | Laurels needs a different way to get posters |
| 14 | The socket sends the sessions of other users | Websocket: user ids seen (2 or more) | Session recorder in P2 | The recorder sees only the owner. A Tautulli import is the only source of sessions for other users. |
| 15 | The socket sends pause and stop | Websocket: states seen | Pause time works as in PLAN.md | Use the 5-minute force stop |
| 16 | Events come about every 10 seconds | Websocket: median gap | No change | Write down the real gap |
| 17 | Live sessions give the user and the device | Live sessions, Websocket: found in /status/sessions | The recorder knows who watched | The recorder cannot know who watched. Remove the recorder. |
| 18 | Mark as watched adds a history row | Mark as watched (second run) | Treat rows that only Plex has as possibly marked by hand. Do not count them for Epic and Legendary trophies. | No change |
| 19 | The owner has Plex Pass | Server | Webhook trigger in P3 | Polling only |
| 20 | Tautulli runs | Tautulli | Optional import of older sessions in P3 | Sessions start on the day the recorder starts |

The hours in the history table use the time zone of the computer that runs the check.
Each file shows this time zone at the top.
If it is not the time zone of the server, tell us.

---

## 7. Done when

- Collect, listen and both mark-check runs made a `findings.md` file.
- Each `fail` row has a reason.
- [PLAN.md](PLAN.md) section 7 has answers 1 to 20 under "P0 findings", with the date.
- PLAN.md shows each decision that the answers changed.

This check does not cover Plex webhooks (P3), Jellyfin, Emby, the speed of the rule engine,
or remote `plex.direct` addresses.

---

## 8. Problems

| Message | What to do |
|---|---|
| `Set PLEX_URL` | Write your values in `spike/.env`. Run the command in the `laurels` folder with `--env-file=spike/.env`. |
| `Plex returned 401 for /` | The token is not the owner's token, or it expired. Get the token again (step 1.2). |
| `Cannot reach Plex at …` | The IP address or port is wrong, or the address uses https on the LAN. Use `http://IP:32400`. |
| `Token can list accounts: no` | The token is not the owner's token. |
| Listen: `"playing" events received: 0` | Nobody played anything, or the socket did not open. See the first row. |
| `Unknown file extension ".ts"` | Your Node.js version is older than 24. |

---

## 9. Code

All code is in `spike/`. Node.js 24 runs it directly. You do not build or install anything.

| File | Job |
|---|---|
| `main.ts` | Starts the check: reads the settings and runs a mode |
| `Config.ts` | The mode, the settings from `.env` and the output folder |
| `SpikeApp.ts` | Runs the mode and writes `findings.md` |
| `PlexClient.ts` | JSON requests, paging, the image resizer and the socket address |
| `TautulliClient.ts` | Tautulli API requests |
| `Collector.ts` | Collect mode |
| `HistoryReport.ts` | History questions: accounts, paging, devices and times |
| `ItemProbe.ts` | Checks which fields each item has |
| `SessionListener.ts` | Listen mode (websocket, as Tautulli does it) |
| `MarkCheck.ts` | Mark-check mode |
| `Findings.ts`, `Output.ts` | Result tables, and files without the token |
| `helpers/` | Small functions for text and lists |

The check sends the token only in request headers and in the socket address.
It does not print the token. It removes the token from each file before it writes the file.
