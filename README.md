# Lore Atlas

An unofficial fan site with interactive lore timelines for **Wuthering Waves** and **Genshin Impact**.

- `index.html` is the gateway where you pick a world.
- `wuthering-waves.html` is the Wuthering Waves page (data current to version 3.8).
- `genshin-impact.html` is the Genshin Impact page (data current to version 7.2).

It is a plain static site. There is nothing to install or build.

## View it on your computer (localhost)

1. Open a terminal in this folder.
2. Start a small web server:

```bash
python3 -m http.server 8000
```

3. Open `http://localhost:8000` in your browser.

To stop the server, press `Ctrl + C` in the terminal.

## Put it online with GitHub Pages

1. Create a new repository on GitHub.
2. Upload everything in this folder to it, keeping the folder structure the same. `index.html` must sit at the top level.
3. In the repository, open **Settings**, then **Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick the `main` branch and the `/ (root)` folder, then save.
5. After a minute or two the site is live at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## What is in the folder

| Path | What it holds |
| --- | --- |
| `assets/data/wuwa.js`, `assets/data/genshin.js` | All content: chapters, versions, characters, voice lines, relationship notes |
| `assets/data/summary.js` | The numbers and faces shown on the gateway |
| `assets/css/site.css` | All styling. Each world has its own colour and font settings at the top of the file |
| `assets/css/fonts.css`, `assets/fonts/` | The fonts, stored locally so the site works offline |
| `assets/js/app.js` | Timeline, character grid, profile panel and connections graph |
| `assets/js/warp.js` | The animated transition when you switch worlds |
| `assets/js/ambient.js` | The moving backgrounds |
| `assets/img/` | Character icons, portraits and element icons |

## Updating the content

Open `assets/data/wuwa.js` or `assets/data/genshin.js` in a text editor.

- To add a version, add an entry to the `versions` list of the right chapter inside `arcs`.
- To add a character, add an entry to `chars`, then put a square icon at `assets/img/<world>/icons/<id>.webp`. A portrait at `assets/img/<world>/art/<id>.webp` is optional. Set `"art": true` if you add one.
- To add a voice line, add an entry to `lines`. `f` is the id of the speaker, `t` is the id of the character being talked about, and `q` is the quote.
- To add a relationship note, add an entry to `bonds`. The key is the two character ids in alphabetical order, joined with `|`.

## Credits and disclaimer

This is a non-commercial fan project. It is not affiliated with or endorsed by Kuro Games or HoYoverse. Wuthering Waves and Genshin Impact, their characters, artwork and voice lines belong to their respective owners.

Story summaries were written for this site. Voice lines are short excerpts of in-game dialogue.
