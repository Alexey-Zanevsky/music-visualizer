const LYRICS_UNAVAILABLE_MESSAGE = "Unfortunatly, lyrics are not available for this track 😔";

const Lyrics = (() => {
    const endpoint = "https://lrclib.net/api/get";

    function normalizeText(value) {
        return String(value || "").trim();
    }

    function getArtistName(track) {
        if (Array.isArray(track.artists)) {
            return track.artists.join(", ");
        }

        return normalizeText(track.artist);
    }

    function getDurationSeconds(track) {
        const duration = Number(track.duration || track.durationMs || track.duration_ms || 0);

        if (!Number.isFinite(duration) || duration <= 0) {
            return null;
        }

        return duration > 1000 ? Math.round(duration / 1000) : Math.round(duration);
    }

    function buildLrclibUrl(track) {
        const url = new URL(endpoint);
        const title = normalizeText(track.title || track.name);
        const artist = getArtistName(track);
        const album = normalizeText(track.album);
        const duration = getDurationSeconds(track);

        url.searchParams.set("track_name", title);
        url.searchParams.set("artist_name", artist);

        if (album) {
            url.searchParams.set("album_name", album);
        }

        if (duration) {
            url.searchParams.set("duration", String(duration));
        }

        return url;
    }

    function parseTimestamp(value) {
        const match = value.match(/^(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?$/);

        if (!match) {
            return null;
        }

        const minutes = Number(match[1]);
        const seconds = Number(match[2]);
        const fraction = match[3] ? Number(`0.${match[3].padEnd(3, "0").slice(0, 3)}`) : 0;

        if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) {
            return null;
        }

        return minutes * 60 + seconds + fraction;
    }

    function parseSyncedLyrics(lrcText) {
        return normalizeText(lrcText)
            .split(/\r?\n/)
            .flatMap((line) => {
                const timestamps = [...line.matchAll(/\[([0-9:.]+)\]/g)];
                const text = line.replace(/\[[^\]]+\]/g, "").trim();

                if (!timestamps.length || !text) {
                    return [];
                }

                return timestamps
                    .map((timestamp) => ({
                        time: parseTimestamp(timestamp[1]),
                        text
                    }))
                    .filter((item) => item.time !== null);
            })
            .sort((a, b) => a.time - b.time);
    }

    async function fetchSyncedLyrics(track) {
        const title = normalizeText(track?.title || track?.name);
        const artist = getArtistName(track || {});

        if (!title || !artist) {
            return [];
        }

        const response = await fetch(buildLrclibUrl(track));

        if (!response.ok) {
            return [];
        }

        const data = await response.json();

        if (!data || !data.syncedLyrics) {
            return [];
        }

        return parseSyncedLyrics(data.syncedLyrics);
    }

    return {
        fetchSyncedLyrics,
        parseSyncedLyrics,
        unavailableMessage: LYRICS_UNAVAILABLE_MESSAGE
    };
})();
