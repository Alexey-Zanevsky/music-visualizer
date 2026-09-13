const state = {
    track: null,
    progress: 0,
    progressSyncedAt: 0,
    lyrics: [],
    lyricIndex: 0,
    lyricsTrackId: null,
    lyricsRequestId: 0,
    displayMode: "lyrics",
    missingLyricsCountdown: null,
    missingLyricsInterval: null
};

const background = document.getElementById("background");
const cover = document.getElementById("cover");
const title = document.getElementById("track-title");
const artist = document.getElementById("track-artist");
const album = document.getElementById("track-album");
const lyrics = document.getElementById("lyrics");
const bars = document.getElementById("bars");
const visualizer = document.getElementById("visualizer");
const transition = document.getElementById("transition");
const loginButton = document.getElementById("spotify-login");
const logoutButton = document.getElementById("spotify-logout");
const fullscreenButton = document.getElementById("fullscreen-button");
const displayModeButton = document.getElementById("display-mode-button");

const barCount = 72;
const barValues = Array.from({ length: barCount }, () => 0.15);

for (let i = 0; i < barCount; i++) {
    const bar = document.createElement("div");
    bar.className = "bar";
    bars.appendChild(bar);
}

function syncProgress(progressMs) {
    state.progress = Number(progressMs || 0) / 1000;
    state.progressSyncedAt = performance.now();
}

function getCurrentProgress() {
    if (!state.track) {
        return state.progress;
    }

    const elapsed = (performance.now() - state.progressSyncedAt) / 1000;
    const duration = Number(state.track.duration || 0);
    const progress = state.progress + Math.max(0, elapsed);

    return duration > 0 ? Math.min(progress, duration / 1000) : progress;
}

function renderTrack(track) {
    title.textContent = track.title || "";
    artist.textContent = Array.isArray(track.artists) ? track.artists.join(", ") : "";
    album.textContent = track.album || "";

    if (track.cover) {
        cover.src = track.cover;
        background.style.backgroundImage = `url("${track.cover}")`;
    } else {
        cover.removeAttribute("src");
        background.style.backgroundImage = "";
    }
}

function renderLyricsUnavailable() {
    lyrics.innerHTML = "";

    const emptyState = document.createElement("div");
    emptyState.className = "lyrics-empty";

    const timer = document.createElement("div");
    timer.className = "lyrics-countdown";
    timer.style.setProperty("--countdown-progress", "0deg");

    const timerValue = document.createElement("span");
    timerValue.className = "lyrics-countdown-value";
    timerValue.textContent = "10";

    const line = document.createElement("div");
    line.className = "lyric-line placeholder";
    line.textContent = Lyrics.unavailableMessage;

    timer.appendChild(timerValue);
    emptyState.appendChild(timer);
    emptyState.appendChild(line);
    lyrics.appendChild(emptyState);
}

function renderLyricsWindow(lines, activeIndex) {
    stopMissingLyricsCountdown();
    lyrics.innerHTML = "";

    const windowElement = document.createElement("div");
    windowElement.className = "lyrics-window";

    for (let index = activeIndex - 1; index <= activeIndex + 1; index++) {
        const line = document.createElement("div");
        line.className = "lyric-line";

        if (index === activeIndex) {
            line.classList.add("current");
        }

        line.textContent = lines[index]?.text || "";
        windowElement.appendChild(line);
    }

    lyrics.appendChild(windowElement);
}

function setDisplayMode(mode, isManual = false) {
    state.displayMode = mode === "cover" ? "cover" : "lyrics";
    visualizer.classList.toggle("cover-only", state.displayMode === "cover");

    if (state.displayMode === "cover") {
        stopMissingLyricsCountdown();
    }

    displayModeButton.classList.toggle("is-active", state.displayMode === "cover");
    displayModeButton.setAttribute(
        "aria-label",
        state.displayMode === "cover" ? "Show lyrics mode" : "Show cover mode"
    );

    const iconName = state.displayMode === "cover" ? "panel-right-open" : "panel-right-close";
    const labelText = state.displayMode === "cover" ? "Cover mode" : "Lyrics mode";
    displayModeButton.innerHTML = `<i data-lucide="${iconName}"></i><span>${labelText}</span>`;

    if (window.lucide) {
        window.lucide.createIcons();
    }

    if (isManual && state.displayMode === "lyrics" && !state.lyrics.length) {
        startMissingLyricsCountdown();
    }
}

function stopMissingLyricsCountdown() {
    if (state.missingLyricsInterval) {
        clearInterval(state.missingLyricsInterval);
    }

    state.missingLyricsInterval = null;
    state.missingLyricsCountdown = null;
}

function updateMissingLyricsCountdown(secondsLeft) {
    const timer = lyrics.querySelector(".lyrics-countdown");
    const value = lyrics.querySelector(".lyrics-countdown-value");
    const elapsed = 10 - secondsLeft;

    if (timer) {
        timer.style.setProperty("--countdown-progress", `${elapsed * 36}deg`);
    }

    if (value) {
        value.textContent = String(secondsLeft);
    }
}

function startMissingLyricsCountdown() {
    stopMissingLyricsCountdown();

    if (state.displayMode === "cover") {
        return;
    }

    state.missingLyricsCountdown = 10;
    updateMissingLyricsCountdown(state.missingLyricsCountdown);

    state.missingLyricsInterval = setInterval(() => {
        state.missingLyricsCountdown -= 1;
        updateMissingLyricsCountdown(Math.max(1, state.missingLyricsCountdown));

        if (state.missingLyricsCountdown <= 0) {
            stopMissingLyricsCountdown();
            setDisplayMode("cover");
        }
    }, 1000);
}

async function loadLyrics(track) {
    const requestId = state.lyricsRequestId + 1;
    state.lyricsRequestId = requestId;
    state.lyricsTrackId = track.id;
    state.lyrics = [];
    state.lyricIndex = 0;
    stopMissingLyricsCountdown();
    renderLyricsUnavailable();
    setDisplayMode("lyrics");

    try {
        const syncedLyrics = await Lyrics.fetchSyncedLyrics(track);

        if (requestId !== state.lyricsRequestId || state.lyricsTrackId !== track.id) {
            return;
        }

        state.lyrics = syncedLyrics;

        if (!state.lyrics.length) {
            renderLyricsUnavailable();
            startMissingLyricsCountdown();
            return;
        }

        setDisplayMode("lyrics");
        updateLyrics(true);
    } catch (error) {
        console.error("Lyrics:", error);

        if (requestId === state.lyricsRequestId) {
            state.lyrics = [];
            renderLyricsUnavailable();
            startMissingLyricsCountdown();
        }
    }
}

function updateLyrics(forceRender = false) {
    if (!state.lyrics.length) {
        return;
    }

    const progress = getCurrentProgress();
    let activeIndex = 0;

    for (let i = 0; i < state.lyrics.length; i++) {
        if (progress >= state.lyrics[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }

    if (!forceRender && activeIndex === state.lyricIndex) {
        return;
    }

    state.lyricIndex = activeIndex;
    renderLyricsWindow(state.lyrics, activeIndex);
}

function changeTrack(track) {
    visualizer.classList.add("changing");
    transition.classList.add("active");

    setTimeout(() => {
        state.track = track;
        syncProgress(track.progress);

        renderTrack(track);
        loadLyrics(track);

        setTimeout(() => {
            visualizer.classList.remove("changing");
            transition.classList.remove("active");
        }, 80);
    }, 300);
}

async function updateSpotify() {
    try {
        const track = await Spotify.getCurrentTrack();

        if (!track) {
            return;
        }

        syncProgress(track.progress);

        if (!state.track || state.track.id !== track.id) {
            changeTrack(track);
        }
    } catch (error) {
        console.error("Spotify:", error);
    }
}

async function initSpotify() {
    try {
        await Spotify.handleCallback();
    } catch (error) {
        console.error("Spotify authorization:", error);
    }

    if (!Spotify.isLoggedIn()) {
        loginButton.hidden = false;
        logoutButton.hidden = true;

        loginButton.addEventListener("click", () => Spotify.login());
        return;
    }

    loginButton.hidden = true;
    logoutButton.hidden = false;

    logoutButton.addEventListener("click", () => {
        Spotify.logout();
        location.reload();
    });

    await updateSpotify();
    setInterval(updateSpotify, 2000);
}

fullscreenButton.addEventListener("click", async () => {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (error) {
        console.error("Fullscreen:", error);
    }
});

function updateFullscreenButton() {
    const isFullscreen = Boolean(document.fullscreenElement);

    fullscreenButton.classList.toggle("is-active", isFullscreen);
    fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
}

document.addEventListener("fullscreenchange", updateFullscreenButton);

displayModeButton.addEventListener("click", () => {
    setDisplayMode(state.displayMode === "cover" ? "lyrics" : "cover", true);
});

function animateBars() {
    const elements = bars.children;
    const time = Date.now();

    for (let i = 0; i < elements.length; i++) {
        const wave = Math.sin(time * 0.004 + i * 0.55) * 0.18;
        const secondary = Math.sin(time * 0.0017 + i * 0.21) * 0.12;
        const target = Math.max(0.08, Math.min(1, 0.32 + wave + secondary));

        barValues[i] += (target - barValues[i]) * 0.18;
        elements[i].style.height = `${barValues[i] * 100}%`;
    }

    updateLyrics();
    requestAnimationFrame(animateBars);
}

loginButton.hidden = true;
logoutButton.hidden = true;
renderLyricsUnavailable();
animateBars();
initSpotify();
updateFullscreenButton();
setDisplayMode("lyrics");

if (window.lucide) {
    window.lucide.createIcons();
}
