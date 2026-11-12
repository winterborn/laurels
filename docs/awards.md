# Add your own awards

You can add awards, change awards and remove awards.
You do not need to build the image again.

## On the Settings page

1. Open **Settings**, then go to **Your awards**.
2. Click **Add an award**. To change or remove a built-in award, select it, then click **Change it** or **Remove it**.
3. Fill in the name, what to watch, the citation, the tier and the category.
4. In **Start from**, select a rule that is near what you want. Then change the numbers and the filter.
5. Click **Check**. Laurels shows the problem, or the progress of each person.
6. Click **Done**, then **Save awards**.

Laurels writes the file `awards.json` for you and counts the awards again at once.

## In the file

You can also edit `awards.json` by hand.

1. Make a file named `awards.json` in the Laurels config folder.
   This is the folder that Docker mounts as `/config`, next to `settings.json`.
2. Put a list of awards in the file. Use the examples below.
3. Wait for the next check for new watches. Laurels reads the file again when it changes.
4. Read the container log. Laurels writes `Loaded N achievements`.
   It also writes a line for each entry that it skipped, with the reason.

If the file is not valid JSON, Laurels keeps the awards that it had before.

## Add an award

```json
[
    {
        "id": "my_westerns",
        "title": "High noon",
        "description": "Watch 10 different westerns.",
        "flavorText": "For ten showdowns at the end of the street.",
        "tier": "Uncommon",
        "section": "film",
        "rule": {
            "type": "count",
            "filter": {
                "kind": "movie",
                "genre": "Western"
            },
            "distinct": "item",
            "target": 10
        }
    }
]
```

| Field | Value |
|---|---|
| `id` | A name that no other award uses. Use letters, numbers and `_`. Do not change it later, because won awards use it. |
| `title` | The name of the award. |
| `description` | What a person must watch. Give the number and the unit. |
| `flavorText` | The citation. Start it with "For". |
| `tier` | `Common`, `Uncommon`, `Rare`, `Epic` or `Legendary`. The page shows Official selection, Special mention, Winner, Grand prize or Lifetime achievement. |
| `section` | `film`, `tv` or `both`. The page shows Film, Television or Screen. |
| `secret` | Optional. `true` hides the rule until a person wins the award. |
| `rule` | What Laurels counts. See the rule types below. |

## Change a built-in award

Give the `id` of the built-in award and only the fields that you want to change.
A new `rule` replaces the full rule.

```json
[
    {
        "id": "film_10",
        "title": "Regular customer"
    }
]
```

The built-in awards are in [achievements/achievements.json](../achievements/achievements.json).

## Remove a built-in award

```json
[
    {
        "id": "tv_graveyard",
        "remove": true
    }
]
```

## Rule types

Each rule has a `type` and a `target`.
Most rules also take a `filter` (see [Filters](#filters)).

| Type | Counts | Example |
|---|---|---|
| `count` | Watches. Add `"distinct": "item"` to count each film or episode once, or `"distinct": "show"` to count each show once. Add `"groupBy"` to need the target from one `director`, `actor`, `studio`, `show` or `item`. | `{"type": "count", "filter": {"kind": "movie"}, "groupBy": "director", "distinct": "item", "target": 5}` |
| `hours` | Hours watched. | `{"type": "hours", "target": 100}` |
| `streak` | Days in a row with a watch. | `{"type": "streak", "target": 7}` |
| `window` | Watches in one `day`, `month` or `year`, or in any `24h`. Add `"distinct": "day"` to count days, not watches. Add `"measure": "hours"` to count hours. Add `"groupBy": "show"` or `"item"` to need one show or one item. | `{"type": "window", "span": "month", "distinct": "day", "target": 20}` |
| `complete` | Shows or seasons with every episode in your library watched. `set` is `show` or `season`. Add `withinDays` to need the first and last episode close together. Add `minEpisodes` or `maxEpisodes` for the size of the set. | `{"type": "complete", "set": "show", "withinDays": 7, "target": 1}` |
| `shared` | Films or episodes that other people also watched within `withinDays`. Add `people` to need more than one other person. Each item counts once. | `{"type": "shared", "withinDays": 7, "people": 3, "target": 1}` |
| `variety` | Different values of one thing (see [Things to group by](#things-to-group-by)). Add `span` (`day`, `month` or `year`) to need them in one period. | `{"type": "variety", "of": "decade", "target": 8}` |
| `chain` | Watches back to back, with at most `maxGapHours` between them. With `steps`, each watch matches its step, in order. With `same` and `length`, each watch shares one value. | `{"type": "chain", "same": "director", "length": 2, "maxGapHours": 3, "target": 1}` |
| `comeback` | Watches of an `item` or a `show` after at least `minDays` away from it. | `{"type": "comeback", "groupBy": "show", "minDays": 365, "target": 1}` |
| `anniversary` | The same item on the same date in `target` different years. | `{"type": "anniversary", "target": 3}` |
| `outOfOrder` | With `set` `season`: a season finale before episode 1. With `set` `collection`: a later film of a collection before an earlier one. | `{"type": "outOfOrder", "set": "collection", "target": 1}` |
| `backwards` | Episodes of one season back to back, each one the episode before the last. | `{"type": "backwards", "target": 3}` |
| `first` | Items that you watched before anyone else in the house. Another person must watch them later. | `{"type": "first", "target": 10}` |
| `awards` | Other awards won. | `{"type": "awards", "target": 25}` |

## Filters

A watch counts only if it matches every field in the filter.

| Field | Value |
|---|---|
| `kind` | `movie` or `episode` |
| `genre` | A Plex genre, for example `Horror`. Episodes use the genres of their show. |
| `yearBefore`, `yearAfter` | The release year is before or after this year. |
| `durationMin`, `durationMax` | The running time in minutes. `durationMin` counts the number itself. `durationMax` does not. |
| `hourFrom`, `hourTo` | The local hour that the watch started, 0 to 23. `hourTo` does not count the hour itself. `hourFrom` 22 and `hourTo` 2 means 22:00 to 01:59. |
| `episodeIndex` | The number of the episode in its season, for example `1`. |
| `seasonMin` | The season number is this number or higher. |
| `isFinale` | `true`: the last episode of its season. |
| `weekdays` | Days of the week that the watch started: `0` is Sunday, `6` is Saturday. |
| `dates` | Dates that the watch started, as `"MM-DD"`, for example `["12-25"]`. |
| `onReleaseDate` | `true`: the watch started on the date that the item came out, in any year. |
| `titleWords` | Whole words in the title. Any of them matches. Not case-sensitive. |
| `titleWordsMin`, `titleWordsMax` | The number of words in the title. |
| `ratings` | Content ratings, for example `["R", "18"]`. `gb/18` matches `18`. |
| `ageMin`, `ageMax` | Years from the release year to the year of the watch. `0` is the same year. |
| `crossesMidnight` | `true`: the watch started on one day and ended on the next. |
| `pausedMin` | Seconds paused during the watch. This needs Tautulli. |

## Things to group by

`groupBy`, `of` and `same` take one of these:
`actor`, `collection`, `country`, `decade`, `director`, `genre`, `hour`, `item`, `letter` (the first letter of the title, A to Z), `platform` (needs Tautulli), `rating`, `season`, `show`, `studio` and `weekday`.
Episodes use their show for `genre`, `country` and `decade`.

Times and days use the time zone in Settings.
Plex history gives the end of a watch, not the start.
Laurels calculates the start from the running time.
If you connect Tautulli, Laurels uses the real start time and the real time watched.
