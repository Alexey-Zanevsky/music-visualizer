const Spotify = {
    clientId: "c055c07fdcc341bca4beddc74540d00c",
    redirectUri: "http://127.0.0.1:5500",
    scopes: ["user-read-currently-playing"],

    async login() {
        const verifier = this.generateCodeVerifier();
        const challenge = await this.generateCodeChallenge(verifier);

        localStorage.setItem("spotify_code_verifier", verifier);

        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: "code",
            redirect_uri: this.redirectUri,
            scope: this.scopes.join(" "),
            code_challenge_method: "S256",
            code_challenge: challenge
        });

        window.location.href = `https://accounts.spotify.com/authorize?${params}`;
    },

    async handleCallback() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (!code) return false;

        const verifier = localStorage.getItem("spotify_code_verifier");

        if (!verifier) {
            throw new Error("Spotify code verifier not found.");
        }

        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: this.clientId,
                grant_type: "authorization_code",
                code,
                redirect_uri: this.redirectUri,
                code_verifier: verifier
            })
        });

        if (!response.ok) {
            throw new Error("Failed to exchange Spotify authorization code.");
        }

        const data = await response.json();

        this.saveTokens(data);
        localStorage.removeItem("spotify_code_verifier");
        window.history.replaceState({}, document.title, window.location.pathname);

        return true;
    },

    async refreshToken() {
        const refreshToken = localStorage.getItem("spotify_refresh_token");

        if (!refreshToken) return false;

        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: this.clientId,
                grant_type: "refresh_token",
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            this.logout();
            return false;
        }

        const data = await response.json();
        this.saveTokens(data, refreshToken);

        return true;
    },

    saveTokens(data, existingRefreshToken = null) {
        localStorage.setItem("spotify_access_token", data.access_token);

        if (data.refresh_token || existingRefreshToken) {
            localStorage.setItem(
                "spotify_refresh_token",
                data.refresh_token || existingRefreshToken
            );
        }

        localStorage.setItem(
            "spotify_token_expires",
            String(Date.now() + data.expires_in * 1000)
        );
    },

    async getAccessToken() {
        const token = localStorage.getItem("spotify_access_token");
        const expires = Number(localStorage.getItem("spotify_token_expires"));

        if (!token) return null;

        if (Date.now() >= expires - 60000) {
            if (!await this.refreshToken()) return null;
            return localStorage.getItem("spotify_access_token");
        }

        return token;
    },

    async getCurrentTrack() {
        const token = await this.getAccessToken();

        if (!token) return null;

        const response = await fetch(
            "https://api.spotify.com/v1/me/player/currently-playing",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (response.status === 204) return null;

        if (response.status === 401) {
            if (!await this.refreshToken()) return null;
            return this.getCurrentTrack();
        }

        if (!response.ok) {
            throw new Error(`Spotify API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.item || data.currently_playing_type !== "track") {
            return null;
        }

        return {
            id: data.item.id,
            title: data.item.name,
            artists: data.item.artists.map(artist => artist.name),
            album: data.item.album.name,
            cover: data.item.album.images[0]?.url || null,
            progress: data.progress_ms || 0,
            duration: data.item.duration_ms,
            isPlaying: data.is_playing
        };
    },

    isLoggedIn() {
        return Boolean(localStorage.getItem("spotify_access_token"));
    },

    logout() {
        localStorage.removeItem("spotify_access_token");
        localStorage.removeItem("spotify_refresh_token");
        localStorage.removeItem("spotify_token_expires");
        localStorage.removeItem("spotify_code_verifier");
    },

    generateCodeVerifier(length = 64) {
        const characters =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        const values = crypto.getRandomValues(new Uint8Array(length));

        return Array.from(values)
            .map(value => characters[value % characters.length])
            .join("");
    },

    async generateCodeChallenge(verifier) {
        const data = new TextEncoder().encode(verifier);
        const digest = await crypto.subtle.digest("SHA-256", data);

        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }
};
