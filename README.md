# ISM 4421 projects

This repository holds two separate web apps. Each lives in its own folder with its own
`netlify.toml`, and each deploys as its own Netlify site.

| Project | Folder | What it is |
| --- | --- | --- |
| **Owl Beats** 🎵 | [`music/`](music/) | AI music generator using the Suno API. Visitors enter their own API key. |
| **Owl Weather** 🦉 | [`weather/`](weather/) | FAU-themed weather app using Open-Meteo (no key needed). |

## Deploying to Netlify

**One site for both (simplest):** import the repo with no base directory. The site then has a
home page at `/` linking to `/music/` and `/weather/`.

**Separate sites:**

1. At https://app.netlify.com choose **Add new site → Import an existing project → GitHub**.
2. Select `marcbonshark/ism4421` and branch `main`.
3. Set **Base directory** to the project's folder (`music` or `weather`). Leave the build command empty.
4. Click **Deploy**.

Repeat with the other folder to create a second, independent site. See each folder's README for details.
