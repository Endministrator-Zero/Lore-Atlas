# Lore Atlas

An unofficial fan site for **Wuthering Waves** and **Genshin Impact**: story timelines with every main quest, the current version's banners and events, character builds, weapons and materials, a tier list, bosses, popular teams, and the voice lines that connect the cast, with 3D scenes built in three.js.

- `index.html` is the gateway where you pick a world.
- `wuthering-waves.html` is the Wuthering Waves page.
- `genshin-impact.html` is the Genshin Impact page.

It is a plain static site. Visitors need nothing installed.

## View it on your computer (localhost)

1. Open a terminal in this folder.
2. Start a small web server:

```bash
python3 -m http.server 8000
```

3. Open `http://localhost:8000` in your browser.

To stop the server, press `Ctrl + C` in the terminal. Opening the HTML files by double-clicking does not work, because the 3D scenes need a web server.

## How the site updates by itself

The file `.github/workflows/update.yml` tells GitHub to run the updater twice a day:

- a few minutes after the daily server reset, which is 4:00 AM China time (UTC+8), 20:00 UTC, or 1:30 AM India time
- again at 11:35 AM China time, after version-day maintenance and second-phase banners go live

GitHub can start scheduled runs a little late when it is busy. The updater is the script `tools/update.mjs`. When something changed, GitHub commits the new data and the live site refreshes.

What the updater refreshes without any help:

| Updated automatically | Where it comes from |
| --- | --- |
| New characters, their icons, elements, weapons and factions | Public game data files |
| Voice lines and the connections graph | Public game data files |
| Ascension and skill materials, and which boss drops them | Public game data files |
| The current version, its dates and the next version | The Fandom wikis |
| Banners, events, new outfits, new story quests and areas | The Fandom wikis and the games' own announcement feeds |
| The pull estimate | A formula based on the version's length and events |
| A basic timeline entry for a brand-new version | The Fandom wikis |
| Main story acts, their quests and official quest descriptions for every version | Game data files and the Fandom wikis |
| Every weapon: stats at level 90, passive, ascension materials and icon | Game data files |
| Artifact sets and echo sets: effects and icons | Game data files |
| Signature weapon of a new character | Read from the new version's paired banners |
| New characters in the tier list, shown in a "Not rated yet" row | Automatic |
| Banner history: every limited banner since 1.0, and how many banner phases have passed since each character's last one | The Fandom wikis (version and banner pages) |
| Imaginarium Theater: this month's elements, opening characters, guest stars, and the best teams that fit them | The Genshin wiki's season page, scored with this site's tier list and team list |
| The gateway page: live version, banners on now, Theater elements and the daily reset countdown | Built from the same data |

What still needs a person, because no data source has it:

| Written by hand | File to edit |
| --- | --- |
| Story summaries and character lore | `content/<game>/story.json` |
| Character builds and team suggestions | `content/<game>/builds.txt` |
| Popular endgame teams and their substitutes | `content/<game>/teams.json` |
| Short notes about bosses | `content/<game>/bosses.json` |
| Tier placements | `content/<game>/tiers.json` |
| Signature weapons (older characters) | `content/<game>/signatures.json` |

Until someone writes them, a new version shows an automatic summary marked "Auto entry", and a new character shows the game's own one-line description with no build.

### The checklist issue

After each daily run, GitHub keeps one issue open in your repository called **Content to write for Lore Atlas**. It lists exactly what is missing, for example "Builds for Lily" or "Tier placements for Lily". When everything is written, the issue closes by itself. You can see it under the **Issues** tab.

To run the daily update by hand on GitHub: open the repository, click **Actions**, choose **Update game data**, then **Run workflow**.

## Running the updater on your computer

You need Node.js 20 or newer.

```bash
cd tools
```

```bash
npm install
```

```bash
node update.mjs
```

After editing the HTML template in `tools/pages.mjs`, rebuild the three pages with:

```bash
node tools/pages.mjs
```

## What is in the folder

| Path | What it holds |
| --- | --- |
| `content/` | Everything written by hand: story, builds, teams, boss notes |
| `tools/` | The updater and the page generator |
| `assets/data/` | The generated data the pages read. Do not edit by hand; it is overwritten |
| `assets/css/site.css` | All styling. Each world has its own colours and fonts at the top of the file |
| `assets/js/app.js` | Every page section: current version, timeline, characters, bosses, teams, connections |
| `assets/js/scene.js` | The 3D scenes, built with three.js |
| `assets/js/gate.js` | The live cards and art on the gateway page |
| `assets/js/warp.js`, `assets/js/ambient.js` | The world-switch transition and the moving backgrounds |
| `assets/vendor/` | A copy of three.js (MIT licence) |
| `assets/img/`, `assets/fonts/` | Icons, portraits, material icons and fonts |

## Updating the tier list

`content/<game>/tiers.json` has one entry per tier (SS, S, A, B, C) with three lists of names: Main DPS, Sub DPS and Support. Move names between lists, then change `"reviewed"` to the current version. Until you do, the page says the list has not been reviewed for the new version yet.

## Writing teams

Each team in `content/<game>/teams.json` has a `name`, a list of `chars`, a short `note`, and optional `subs`: a cheaper or more common swap for a slot, for example `"subs": { "Yelan": ["Xingqiu"] }`. The Imaginarium Theater tab is not written by hand: it is rebuilt from this team list every month.

## Writing a build

Each line in `content/<game>/builds.txt` is one character. Fields are separated by ` | `:

```
Name | Role | Weapons | Sets | Main stats | Substats | Skill priority | Teams | Note
```

Separate several weapons, sets or teams with `;`. List the best set first; a 2-piece mix can be written as `Set A (2) + Set B (2)`. Inside a team, separate names with `,`. Put the word "Provisional" in the note to show an "Early guide" label.

## Credits and disclaimer

This is a non-commercial fan project. It is not affiliated with or endorsed by Kuro Games or HoYoverse. Wuthering Waves and Genshin Impact, their characters, artwork and voice lines belong to their respective owners.

Story summaries, lore notes and builds were written for this site. Voice lines are short excerpts of in-game dialogue. Popular teams are hand-picked and are not usage statistics. The pull estimate is an approximation.

Image sources: paimon.moe, miao-plugin and the Wuthering-Waves-GameAssets repository on GitHub.

Data sources: genshin-db, the AnimeGameData and WutheringWaves_Data dumps, the Fandom wikis for both games, and each game's official announcement feed.
