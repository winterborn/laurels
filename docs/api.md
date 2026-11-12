# Laurels API

All routes send and receive JSON.
A route that reads awards needs a signed-in session or guest view.
A route that changes settings needs the owner.

## Awards

| Route | Gives |
|---|---|
| `GET /api/definitions` | All awards: title, category, tier, points, laurel word, citation, who holds it and household share |
| `GET /api/users` | The people, sorted by points, with their rank, latest award, and film and episode counts |
| `GET /api/users/:id` | One person: awards, progress and totals |
| `GET /api/awards` | All awards of all people, newest first |
| `GET /api/awards?user=:id` | The awards of one person |
| `GET /api/progress` | Progress of each person on each award |
| `GET /api/progress?user=:id` | Progress of one person |
| `GET /api/latest` | The 8 newest awards in the household |
| `GET /api/award/:id?user=:id` | One award for one person: credits, household and related awards |
| `GET /api/ceremony?range=all\|year\|month` | The household standings |
| `GET /api/season/:id?year=:year` | One person's season review |
| `GET /api/poster/:ratingKey` | The Plex poster for an item |

`/api/awards` and `/api/progress` use the same names as the
Audiobookshelf achievement engine, so tools for that project can also read Laurels.

`category` is `Film`, `Television` or `Screen`.
`holderIds` lists the people who hold the award, oldest win first.

`householdShare` is a number from 0 to 1.
It is `null` when the server has fewer than 5 people.

## Sign-in

| Route | Does |
|---|---|
| `GET /api/auth/me` | Gives the role and name of the person, or `role: null` |
| `POST /api/auth/sign-in` | Starts a Plex sign-in and gives the Plex address to open |
| `GET /api/auth/sign-in/:id` | Gives `signedIn: true` after the person signs in on Plex, and sets the session cookie |
| `POST /api/auth/sign-out` | Ends the session |

## Settings (owner only)

| Route | Does |
|---|---|
| `GET /api/status` | Gives the last sync and the counts |
| `GET /api/settings` | Gives the settings. It does not give the Plex token. |
| `POST /api/settings` | Saves the settings |
| `POST /api/settings/test-plex` | Tests a Plex address and token |
| `POST /api/settings/test-discord` | Sends a test message to Discord |
| `GET /api/plex/servers` | Gives the Plex servers of the owner account |

## Other

| Route | Gives |
|---|---|
| `GET /health` | `{ "ok": true }`. Docker uses it for the health check. |

## Achievements file

Laurels reads `achievements/achievements.json` again at the start of each sync
if the file changed.
If the new file has an error, Laurels keeps the last good list and writes the error to the log.
