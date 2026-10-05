# Owl Beats 🎵🦉

A one-page AI music generator for ISM 4421, built on the [Suno API](https://docs.sunoapi.org).
Describe a song (or write your own lyrics), pick a style, and get two full versions back to play, download or extend.

## Using it

1. Open the site and sign in with your email and password (or click **Create an account**).
2. Click **🔑 Add API key**.
3. Paste your Suno API key (get one at https://sunoapi.org/api-key) and click **Save**.
4. Describe your song, pick a style, and click **Generate music**.

The key is stored only in your browser (localStorage) and is sent only to `api.sunoapi.org`.
Every visitor uses their own key and credits. Use **Remove key** in the key dialog to delete it
(do this on shared computers).

## Login (Supabase)

Email and password login uses [Supabase Auth](https://supabase.com/docs/guides/auth) on the project
`fpqrnrtxbrfnghpwawbl`. The project URL and publishable key are in `config.js`. The publishable key is
designed to be public.

- **Sign in**, **Create an account** (with email confirmation), **Forgot password?** (emails a reset
  link that opens a "Choose a new password" screen), and **Sign out** in the header.
- Each account gets its own saved Suno key and track list in the browser, so people sharing a
  computer don't see each other's songs. Data saved before login existed moves to the first account
  that signs in on that browser.
- Every signup also gets a row in `public.profiles` (id, email), created by the `on_auth_user_created`
  trigger. Row-level security lets each user read and update only their own row.

The login screen is a gate in the browser, not server-side protection: the page's code is public.
That's fine here because the app has no private server data and each person uses their own Suno key.

**One-time Supabase setting:** in the Supabase dashboard go to **Authentication → URL Configuration**
and set **Site URL** to your Netlify address (for example `https://your-site.netlify.app/music/`, or
`https://your-site.netlify.app/` if the site's base directory is `music`). Add the same address under
**Redirect URLs**. Without it, confirmation and password-reset emails link to `localhost`.

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
auth.js           Email login screen (Supabase Auth)
config.js         Supabase project URL and publishable key
vendor/supabase.js  Supabase JS client v2.117.2 (browser build, kept local)
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
