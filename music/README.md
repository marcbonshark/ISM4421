# Owl Beats 🎵🦉

A one-page AI music generator for ISM 4421, built on the [Suno API](https://docs.sunoapi.org).
Describe a song (or write your own lyrics), pick a style, and get two full versions back to play, download or extend.

## Using it

1. Open the site and click **🔑 Add API key**.
2. Paste your Suno API key (get one at https://sunoapi.org/api-key) and click **Save**.
3. Describe your song, pick a style, and click **Generate music**.

The key is stored only in your browser (localStorage) and is sent only to `api.sunoapi.org`.
Every visitor uses their own key and credits. Use **Remove key** in the key dialog to delete it
(do this on shared computers).

## Features

- **Simple mode**: describe the song and pick a style; Suno writes the lyrics.
- **Custom mode**: title, your own lyrics, song length (10 seconds to 6 minutes), male/female voice,
  styles to exclude, and advanced controls (style adherence, weirdness, variety).
- **✨ Write lyrics with AI**: generates lyrics from a short idea and drops them into the editor.
- **Instrumental** toggle for tracks with no vocals.
- **Models**: V6 (recommended), V6 Wild (more creative), V6 Mini (fastest).
- Live progress: tracks start streaming as soon as Suno has a preview, then switch to the final file.
- Play, **download MP3**, view and copy lyrics, and **extend** a track from any point.
- **Reuse** loads a past request's settings back into the form.
- Remaining **credits** shown in the header (click to refresh).
- Your track list is saved in the browser. Suno deletes files after 14 days, so download the ones you want.
- Light and dark themes, and it works on phones.

## Suno API endpoints used

| Feature | Endpoint |
| --- | --- |
| Generate music | `POST /api/v1/generate` |
| Check progress / get tracks | `GET /api/v1/generate/record-info?taskId=…` |
| Extend a track | `POST /api/v1/generate/extend` |
| Generate lyrics | `POST /api/v1/lyrics`, then `GET /api/v1/lyrics/record-info?taskId=…` |
| Remaining credits | `GET /api/v1/generate/credit` |

Suno requires a `callBackUrl` on every task. This app polls for results instead, so it sends a
placeholder callback URL.

## Project structure

```
index.html        Page markup
style.css         Styles (FAU blue and red, light/dark)
app.js            Suno API calls, polling, rendering
theme.js          Applies the saved theme before the page draws
assets/icon.svg   App icon
404.html          Not-found page
netlify.toml      Netlify settings: publish dir, security headers, caching
```

Plain HTML, CSS and JavaScript: no build step, no server code, nothing to install.

## Run locally

```bash
cd music
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy to Netlify

1. At https://app.netlify.com choose **Add new site → Import an existing project**.
2. Pick **GitHub** and select `marcbonshark/ism4421`, branch `main`.
3. Set **Base directory** to `music`. `music/netlify.toml` fills in the rest (publish directory, no build command).
4. Click **Deploy**. Every push to `main` that touches `music/` redeploys the site.

No environment variables are needed. You can also drag the `music` folder onto https://app.netlify.com/drop.

## Credits

Music generation by [Suno API](https://sunoapi.org). Student project; not an official Florida Atlantic University website.
