# Music Visualizer

![Music Visualizer](docs/main-screen.png)

> **ONLY FOR SPOTIFY!!!**

A fullscreen music visualization web application designed for displaying Spotify playback on a projector or large screen.

Spotify remains responsible for playing and switching music. Music Visualizer only reads the current playback information and creates the visual presentation.

## Features

- Spotify account authorization via PKCE
- Current song title, artists and album
- Album artwork and blurred rotating background
- Playback progress synchronization
- Animated visualizer bars
- Synchronized lyrics via LRCLIB
- Cover-only mode when synchronized lyrics are unavailable
- Smooth track transitions
- Sidebar with visualizer controls

## How It Works

```text
Spotify
   │
   │ Web API
   ▼
Music Visualizer
   │
   ├── Track information
   ├── Album artwork
   ├── Playback progress
   └── Synchronized lyrics
```

The application does **not** receive or process Spotify's audio stream.

## Project Structure

```text
music-visualizer/
│
├── index.html
├── style.css
├── app.js
├── spotify.js
├── lyrics.js
└── README.md
```

- `index.html` — application structure
- `style.css` — layout, visual design and animations
- `app.js` — visualizer logic and UI updates
- `spotify.js` — Spotify authentication and Web API
- `lyrics.js` — LRCLIB requests and LRC parsing

## Requirements

- Spotify account
- Spotify Developer application
- Visual Studio Code
- Live Server extension
- Modern web browser

Python and a backend server are **not required**.

## Spotify Setup

Create an application in the Spotify Developer Dashboard.

Set the Redirect URI to:

```text
http://127.0.0.1:5500
```

This must exactly match the address used by Live Server.

Then open `spotify.js` and replace:

```js
clientId: "YOUR_CLIENT_ID",
```

with the Client ID from your Spotify Developer application.

The Client ID is **not** the Redirect URI.

## Running

1. Open the project in VS Code.
2. Open `index.html` with **Live Server**.
3. Open the application in the browser.
4. Click **Connect Spotify**.
5. Authorize the application.
6. Start playing music in Spotify.

The visualizer will automatically update when the current track changes.

## Lyrics

Synchronized lyrics are loaded from **LRCLIB**.

Only synchronized lyrics are used. If they are unavailable, the application switches to the cover-only display mode.

The lyrics are synchronized using Spotify playback progress.

## Important Notes

Spotify controls the actual music playback. The visualizer only reads playback metadata through the Spotify Web API.

The bottom visualizer bars are animated graphics and are **not** generated from the Spotify audio stream.

The project is currently intended for local use with VS Code Live Server.

## Future Development

Possible future improvements:

- More visual themes
- Improved lyric synchronization
- Additional visual effects
- Experimental audio-reactive visualization
- Interactive presentation elements

## License

This project is intended for personal and educational use.
