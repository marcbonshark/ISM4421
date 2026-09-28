# Owl Weather 🦉

An FAU-themed weather app for ISM 4421. It opens on **Florida Atlantic University, Boca Raton** (26.3728, -80.1024) and can look up any city worldwide.

Weather and city search come from [Open-Meteo](https://open-meteo.com/), which is free and needs no API key or account.

## Features

- Current conditions: temperature, feels-like, humidity, wind and gusts, precipitation, cloud cover, pressure, UV index, sunrise and sunset
- Hourly forecast for the next 24 hours, with chance of rain
- 7-day forecast
- City search with suggestions as you type (Open-Meteo Geocoding API)
- "My location" button (browser geolocation) and a "FAU Boca" button that returns to campus
- °F / °C toggle; the browser remembers your choice
- Refreshes every 15 minutes; works on phones; supports dark mode
- FAU colors: Blue `#003366`, Red `#CC0000`, Silver `#A7A9AC`

## Project structure

```
index.html        Page markup
style.css         FAU-branded styles
app.js            Open-Meteo calls and rendering
assets/logo.svg   Owl emblem (logo + favicon)
404.html          Not-found page
netlify.toml      Netlify settings: publish dir, security headers, caching
```

It's plain HTML, CSS, and JavaScript, so there's no build step and nothing to install.

## Run locally

Serve the folder with any static server, then open http://localhost:8000:

```bash
python3 -m http.server 8000
```

## Deploy to Netlify

**Option A: Git (recommended; redeploys on every push)**
1. Log in at https://app.netlify.com and choose **Add new site → Import an existing project**.
2. Pick **GitHub** and select `marcbonshark/ism4421`.
3. Set the branch to deploy. `netlify.toml` already fills in the build settings: publish directory `.`, no build command.
4. Click **Deploy**. Netlify gives you a URL like `https://<name>.netlify.app`. You can rename it under **Site configuration → Change site name**.

**Option B: Drag and drop**
Go to https://app.netlify.com/drop and drag this project folder onto the page.

**Option C: Netlify CLI**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir .
```

## Using the official FAU logo

`assets/logo.svg` is an original owl emblem drawn in FAU colors. It is not the university's official mark. To use the official FAU logo, download it from FAU's brand resources, save it as `assets/logo.svg`, or save it as a PNG and change the `src`/`href` values in `index.html`. FAU logos are trademarks, so check FAU's brand guidelines for how they may be used.

## Credits

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under CC BY 4.0. Student project; not an official Florida Atlantic University website.
