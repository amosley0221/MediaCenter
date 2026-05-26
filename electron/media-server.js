const crypto = require("node:crypto");
const dgram = require("node:dgram");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { loadLiveTvData } = require("./live-tv");
const { loadLibrary } = require("./media-library");

const DISCOVERY_HOST = "239.255.79.101";
const DISCOVERY_PORT = 40906;
const DISCOVERY_INTERVAL_MS = 5000;

const VIDEO_MIME_TYPES = {
  ".avi": "video/x-msvideo",
  ".m2ts": "video/mp2t",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".ts": "video/mp2t",
  ".webm": "video/webm",
  ".wmv": "video/x-ms-wmv",
};
const IMAGE_MIME_TYPES = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function clampPort(port) {
  const parsedPort = Number(port);
  return Number.isInteger(parsedPort) && parsedPort >= 1024 && parsedPort <= 65535 ? parsedPort : 8096;
}

function clampMbps(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 2 && parsedValue <= 1000 ? Math.round(parsedValue) : 80;
}

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(Boolean)
    .filter((networkInterface) => networkInterface.family === "IPv4" && !networkInterface.internal)
    .map((networkInterface) => networkInterface.address);
}

function getClientUrls(port) {
  return [`http://127.0.0.1:${port}/`, ...getLanAddresses().map((address) => `http://${address}:${port}/`)];
}

function normalizeRemoteAddress(address = "") {
  return address.replace(/^::ffff:/, "");
}

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isSameNetworkAddress(address = "") {
  const normalized = normalizeRemoteAddress(address);
  return normalized === "::1" || normalized === "localhost" || normalized.startsWith("fe80:") || normalized.startsWith("fd") || isPrivateIPv4(normalized);
}

function getPublicId(item) {
  return crypto.createHash("sha256").update(item.id || item.path || item.title || "").digest("base64url").slice(0, 28);
}

function isLocalFileUrl(url = "") {
  return String(url).startsWith("file://");
}

function normalizeArtworkUrl(url = "", itemId = "", kind = "cover") {
  return isLocalFileUrl(url) ? `/artwork/${encodeURIComponent(itemId)}/${encodeURIComponent(kind)}` : url;
}

function getInitials(title = "") {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function sanitizeItem(item) {
  const id = getPublicId(item);

  return {
    addedAt: item.addedAt || "",
    backdropUrl: normalizeArtworkUrl(item.backdropUrl || "", id, "backdrop"),
    coverUrl: normalizeArtworkUrl(item.coverUrl || "", id, "cover"),
    description: item.description || "",
    emulatorPlatform: item.emulatorPlatform || "",
    episodeNumber: item.episodeNumber || null,
    extension: item.extension || "",
    fileSize: item.fileSize || 0,
    headerUrl: normalizeArtworkUrl(item.headerUrl || "", id, "header"),
    id,
    initials: getInitials(item.title || item.seriesTitle),
    meta: item.meta || "",
    metadata: item.metadata || {},
    seasonNumber: item.seasonNumber || null,
    section: item.section,
    seriesTitle: item.seriesTitle || "",
    source: item.source || "",
    summary: item.summary || "",
    title: item.title || "Untitled",
    updatedAt: item.updatedAt || item.addedAt || "",
  };
}

function getAllPlayableItems(library) {
  return [...(library.sections?.movies || []), ...(library.sections?.tv || [])].filter((item) => item.path);
}

function getAllLibraryItems(library) {
  return Object.values(library.sections || {}).flat();
}

function findPlayableItem(library, publicId) {
  return getAllPlayableItems(library).find((item) => getPublicId(item) === publicId);
}

function findLibraryItem(library, publicId) {
  return getAllLibraryItems(library).find((item) => getPublicId(item) === publicId);
}

function sortRecentItems(items) {
  return [...items].sort((a, b) => new Date(b.addedAt || b.updatedAt || 0) - new Date(a.addedAt || a.updatedAt || 0));
}

function groupTvSeries(tvItems) {
  const seriesMap = new Map();

  tvItems.forEach((item) => {
    const seriesTitle = item.seriesTitle || "TV Shows";
    const series = seriesMap.get(seriesTitle) || {
      id: crypto.createHash("sha256").update(seriesTitle).digest("base64url").slice(0, 18),
      initials: getInitials(seriesTitle),
      seasons: new Map(),
      seriesTitle,
    };
    const seasonNumber = item.seasonNumber || 1;
    const season = series.seasons.get(seasonNumber) || {
      episodes: [],
      seasonNumber,
    };

    season.episodes.push(sanitizeItem(item));
    series.seasons.set(seasonNumber, season);
    seriesMap.set(seriesTitle, series);
  });

  return [...seriesMap.values()]
    .map((series) => ({
      ...series,
      seasons: [...series.seasons.values()]
        .map((season) => ({
          ...season,
          episodes: season.episodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0)),
        }))
        .sort((a, b) => a.seasonNumber - b.seasonNumber),
    }))
    .sort((a, b) => a.seriesTitle.localeCompare(b.seriesTitle));
}

function createLibraryPayload(library) {
  const movies = sortRecentItems(library.sections?.movies || []).map(sanitizeItem);
  const tv = sortRecentItems(library.sections?.tv || []).map(sanitizeItem);
  const games = sortRecentItems(library.sections?.games || []).map(sanitizeItem);

  return {
    sections: {
      games,
      movies,
      tv,
    },
    summary: {
      games: games.length,
      movies: movies.length,
      sources: library.sources?.length || 0,
      tv: tv.length,
      updatedAt: library.updatedAt || "",
    },
    tvSeries: groupTvSeries(library.sections?.tv || []),
  };
}

function readRequestBody(request) {
  return new Promise((resolve) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", () => resolve(""));
  });
}

function getRequestPin(request, url) {
  const cookiePin = String(request.headers.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("toneos_pin="))
    ?.slice("toneos_pin=".length);

  return request.headers["x-toneos-pin"] || url.searchParams.get("pin") || (cookiePin ? decodeURIComponent(cookiePin) : "");
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendText(response, statusCode, text, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });
  response.end(text);
}

function getAccessError(request, url, settings) {
  const mediaServerSettings = settings.mediaServer || {};
  const remoteAddress = request.socket.remoteAddress || "";

  if (mediaServerSettings.sameNetworkOnly !== false && !isSameNetworkAddress(remoteAddress)) {
    return {
      code: "LAN_ONLY",
      message: "ToneOS Media Server is limited to same-network devices.",
      statusCode: 403,
    };
  }

  const requiredPin = String(mediaServerSettings.pin || "").trim();

  if (requiredPin && String(getRequestPin(request, url)).trim() !== requiredPin) {
    return {
      code: "PIN_REQUIRED",
      message: "A ToneOS Media Server PIN is required.",
      statusCode: 401,
    };
  }

  return null;
}

function createStatusPayload(status, settings) {
  const port = clampPort(settings.mediaServer?.port);
  const urls = status.running ? getClientUrls(port) : [];
  const mediaServerSettings = settings.mediaServer || {};

  return {
    capabilities: {
      directPlay: mediaServerSettings.directPlay !== false,
      quality: {
        remote: mediaServerSettings.remoteOriginal === false ? "adaptive" : "original",
        remoteFallbackMbps: clampMbps(mediaServerSettings.remoteFallbackMbps),
        sameNetwork: mediaServerSettings.sameNetworkOriginal === false ? "adaptive" : "original",
      },
      gameStreaming: {
        enabled: settings.gameStreaming?.enabled !== false,
        hostSaves: settings.gameStreaming?.hostSaves !== false,
        launchEmulators: settings.gameStreaming?.launchEmulators !== false,
        moonlightHint: settings.gameStreaming?.moonlightHint || "Install Moonlight on remote devices and pair it with Sunshine on this ToneOS PC.",
        provider: settings.gameStreaming?.provider || "Sunshine / Moonlight",
      },
      remoteControl: true,
      transcoding: false,
      transcodingNote: "FFmpeg transcoding is planned for a later build. This version direct-plays compatible files.",
    },
    discovery: {
      address: DISCOVERY_HOST,
      enabled: Boolean(settings.mediaServer?.discovery && status.running),
      port: DISCOVERY_PORT,
    },
    enabled: Boolean(settings.mediaServer?.enabled),
    error: status.error || "",
    name: mediaServerSettings.name || "ToneOS Media Server",
    pinRequired: Boolean(String(mediaServerSettings.pin || "").trim()),
    port,
    running: Boolean(status.running),
    sameNetworkOnly: mediaServerSettings.sameNetworkOnly !== false,
    urls,
  };
}

function getClientHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ToneOS Media Server</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #080817;
        --panel: rgba(18, 18, 42, 0.84);
        --text: rgba(255, 255, 255, 0.94);
        --muted: rgba(255, 255, 255, 0.66);
        --line: rgba(255, 255, 255, 0.12);
        --accent: #7ed957;
      }

      * { box-sizing: border-box; }

      body {
        min-height: 100vh;
        margin: 0;
        background:
          linear-gradient(rgba(255, 255, 255, 0.026) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.023) 1px, transparent 1px),
          radial-gradient(circle at 14% 18%, rgba(228, 83, 181, 0.5), transparent 26%),
          radial-gradient(circle at 86% 12%, rgba(72, 191, 255, 0.5), transparent 30%),
          linear-gradient(135deg, #171631 0%, #272350 48%, #173153 100%);
        background-size: 42px 42px, 42px 42px, auto, auto, auto;
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      button, input { font: inherit; }

      .shell {
        display: grid;
        gap: 18px;
        width: min(1180px, calc(100vw - 28px));
        margin: 0 auto;
        padding: 22px 0 42px;
      }

      .topbar, .panel {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--panel);
        box-shadow: 0 24px 50px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(18px);
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 18px;
      }

      h1, h2, p { margin: 0; }

      h1 {
        font-size: clamp(25px, 5vw, 44px);
        letter-spacing: 0;
        line-height: 1;
      }

      .muted {
        color: var(--muted);
        font-size: 14px;
        font-weight: 550;
      }

      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .tabs button, .pin-card button, .episode button, .game-launch button {
        min-height: 38px;
        padding: 8px 16px;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
        color: var(--text);
        cursor: pointer;
      }

      .tabs button.active, .pin-card button {
        background: rgba(255, 255, 255, 0.92);
        color: #11152a;
      }

      .panel {
        display: grid;
        gap: 18px;
        padding: 18px;
      }

      .detail {
        grid-template-columns: minmax(128px, 210px) minmax(0, 1fr);
        align-items: stretch;
      }

      .detail-poster {
        display: grid;
        min-height: 260px;
        place-items: center;
        overflow: hidden;
        border-radius: 18px;
        background: linear-gradient(135deg, #55c8ff, #6957ff 55%, #16133a);
        background-position: center;
        background-size: cover;
        box-shadow: 0 16px 30px rgba(0, 0, 0, 0.28);
      }

      .detail-poster span {
        display: grid;
        width: 70px;
        height: 70px;
        place-items: center;
        border: 2px solid rgba(255, 255, 255, 0.72);
        border-radius: 50%;
        background: rgba(8, 8, 30, 0.24);
        color: #fff;
        font-size: 20px;
        font-weight: 700;
      }

      .detail-poster.has-cover span {
        display: none;
      }

      .detail-copy {
        display: grid;
        align-content: center;
        gap: 10px;
      }

      .detail-copy h2 {
        font-size: clamp(32px, 7vw, 76px);
        letter-spacing: 0;
        line-height: 0.95;
      }

      .detail-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 8px;
      }

      .detail-actions button {
        min-height: 42px;
        padding: 10px 18px;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.92);
        color: #11152a;
        cursor: pointer;
        font-weight: 700;
      }

      .detail-actions button + button {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text);
      }

      .player {
        display: grid;
        gap: 12px;
      }

      video {
        width: 100%;
        max-height: 62vh;
        border: 1px solid var(--line);
        border-radius: 20px;
        background: #030308;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 14px;
      }

      .card {
        display: grid;
        gap: 9px;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        cursor: pointer;
        text-align: left;
      }

      .poster {
        display: grid;
        aspect-ratio: 2 / 3;
        place-items: center;
        overflow: hidden;
        border-radius: 16px;
        background: linear-gradient(135deg, #55c8ff, #6957ff 55%, #16133a);
        color: rgba(255, 255, 255, 0.92);
        font-size: 26px;
        font-weight: 800;
      }

      .poster img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .card strong, .episode strong {
        overflow: hidden;
        font-size: 15px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .series {
        display: grid;
        gap: 12px;
      }

      .season {
        display: grid;
        gap: 8px;
      }

      .episode {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.06);
      }

      .game-launch {
        display: grid;
        gap: 10px;
      }

      .game-launch button {
        justify-self: start;
        background: rgba(126, 217, 87, 0.92);
        color: #061206;
        font-weight: 750;
      }

      .pin-card {
        display: grid;
        gap: 12px;
        max-width: 420px;
      }

      .pin-card input {
        min-height: 44px;
        padding: 0 16px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(8, 8, 30, 0.66);
        color: var(--text);
      }

      [hidden] { display: none !important; }

      @media (max-width: 680px) {
        .topbar { align-items: start; flex-direction: column; }
        .detail { grid-template-columns: 1fr; }
        .detail-poster {
          min-height: 210px;
          aspect-ratio: 16 / 9;
        }
        .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="muted">TONEOS MEDIA SERVER</p>
          <h1 id="serverName">MediaCenter</h1>
          <p class="muted" id="serverStatus">Connecting...</p>
        </div>
        <nav class="tabs" aria-label="Library sections">
          <button type="button" class="active" data-section="movies">Movies</button>
          <button type="button" data-section="tv">TV Shows</button>
          <button type="button" data-section="games">Games</button>
        </nav>
      </header>

      <section class="panel pin-card" id="pinPanel" hidden>
        <h2>Enter server PIN</h2>
        <p class="muted">This ToneOS server requires a PIN before showing the library.</p>
        <input id="pinInput" type="password" autocomplete="current-password" placeholder="PIN or password" />
        <button type="button" id="pinButton">Connect</button>
      </section>

      <section class="panel detail" id="detailPanel" hidden>
        <div class="detail-poster" id="detailPoster"><span id="detailInitials">MC</span></div>
        <div class="detail-copy">
          <p class="muted" id="detailKicker">MediaCenter</p>
          <h2 id="detailTitle">Select media</h2>
          <p class="muted" id="detailMeta"></p>
          <p class="muted" id="detailSummary"></p>
          <div class="detail-actions">
            <button type="button" id="detailPlayButton">Play</button>
            <button type="button" id="detailCloseButton">Back</button>
          </div>
        </div>
      </section>

      <section class="panel player" id="playerPanel" hidden>
        <video id="player" controls playsinline></video>
        <div>
          <h2 id="playerTitle">Select something to play</h2>
          <p class="muted" id="playerMeta"></p>
        </div>
      </section>

      <section class="panel" id="libraryPanel">
        <h2 id="sectionTitle">Movies</h2>
        <div class="grid" id="movieGrid"></div>
        <div class="series" id="seriesList" hidden></div>
      </section>
    </main>

    <script>
      const state = {
        library: null,
        pin: sessionStorage.getItem("toneos.pin") || "",
        section: "movies",
        selectedItem: null,
        status: null,
      };
      const serverName = document.querySelector("#serverName");
      const serverStatus = document.querySelector("#serverStatus");
      const pinPanel = document.querySelector("#pinPanel");
      const pinInput = document.querySelector("#pinInput");
      const pinButton = document.querySelector("#pinButton");
      const detailPanel = document.querySelector("#detailPanel");
      const detailPoster = document.querySelector("#detailPoster");
      const detailInitials = document.querySelector("#detailInitials");
      const detailKicker = document.querySelector("#detailKicker");
      const detailTitle = document.querySelector("#detailTitle");
      const detailMeta = document.querySelector("#detailMeta");
      const detailSummary = document.querySelector("#detailSummary");
      const detailPlayButton = document.querySelector("#detailPlayButton");
      const detailCloseButton = document.querySelector("#detailCloseButton");
      const playerPanel = document.querySelector("#playerPanel");
      const player = document.querySelector("#player");
      const playerTitle = document.querySelector("#playerTitle");
      const playerMeta = document.querySelector("#playerMeta");
      const sectionTitle = document.querySelector("#sectionTitle");
      const movieGrid = document.querySelector("#movieGrid");
      const seriesList = document.querySelector("#seriesList");
      const tabs = [...document.querySelectorAll(".tabs button")];

      function getHeaders() {
        return state.pin ? { "X-ToneOS-PIN": state.pin } : {};
      }

      async function api(path) {
        const response = await fetch(path, { headers: getHeaders() });
        if (response.status === 401) {
          pinPanel.hidden = false;
          throw new Error("PIN_REQUIRED");
        }
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.json();
      }

      async function postRemoteCommand(command, payload = {}) {
        const response = await fetch("/api/remote", {
          body: JSON.stringify({ command, payload }),
          headers: {
            "Content-Type": "application/json",
            ...getHeaders(),
          },
          method: "POST",
        });

        if (response.status === 401) {
          pinPanel.hidden = false;
          throw new Error("PIN_REQUIRED");
        }

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.ok === false) {
          throw new Error(result.error || result.message || "ToneOS could not start that game.");
        }

        return result;
      }

      function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, (character) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]);
      }

      function poster(item) {
        return item.coverUrl
          ? '<div class="poster"><img src="' + escapeHtml(item.coverUrl) + '" alt="" loading="lazy" /></div>'
          : '<div class="poster">' + escapeHtml(item.initials || "M") + "</div>";
      }

      function getItemSummary(item) {
        return item.metadata?.overview ||
          item.summary ||
          item.description ||
          (item.section === "games"
            ? "Launch this game on the ToneOS host. Use Moonlight with Sunshine for low-latency remote play."
            : "No summary has been added yet. Refresh metadata in ToneOS to fill in descriptions and cover details.");
      }

      function getItemDisplayTitle(item) {
        return item.seriesTitle && item.episodeNumber ? item.seriesTitle + ": " + item.title : item.title;
      }

      function getDetailKicker(item) {
        if (item.section === "tv") {
          return item.seriesTitle || "TV Shows";
        }

        if (item.section === "games") {
          return "Games";
        }

        return item.section === "movies" ? "Movies" : "MediaCenter";
      }

      function showDetails(item) {
        state.selectedItem = item;
        detailPoster.className = "detail-poster";
        detailPoster.style.backgroundImage = "";

        const artworkUrl = item.backdropUrl || item.coverUrl || item.headerUrl || "";
        if (artworkUrl) {
          detailPoster.classList.add("has-cover");
          detailPoster.style.backgroundImage = 'linear-gradient(90deg, rgba(7, 8, 26, 0.2), rgba(7, 8, 26, 0.78)), url("' + String(artworkUrl).replace(/"/g, "%22") + '")';
        }

        detailInitials.textContent = item.initials || "M";
        detailKicker.textContent = getDetailKicker(item);
        detailTitle.textContent = getItemDisplayTitle(item);
        detailMeta.textContent = item.meta || item.extension || "Direct play";
        detailSummary.textContent = getItemSummary(item);
        detailPlayButton.textContent = item.section === "games" ? "Play on host" : "Play";
        detailPanel.hidden = false;
        detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      function playItem(item) {
        const pinQuery = state.pin ? "?pin=" + encodeURIComponent(state.pin) : "";
        player.hidden = false;
        player.src = "/stream/" + encodeURIComponent(item.id) + pinQuery;
        playerPanel.hidden = false;
        playerTitle.textContent = getItemDisplayTitle(item);
        playerMeta.textContent = item.meta || item.extension || "Direct play";
        player.play().catch(() => {});
      }

      async function launchGame(item) {
        player.pause();
        player.removeAttribute("src");
        player.hidden = true;
        playerPanel.hidden = false;
        playerTitle.textContent = item.title;
        playerMeta.textContent = "Starting on the ToneOS host. Saves and save states remain on the host PC.";

        try {
          const result = await postRemoteCommand("game:launch", { id: item.id });
          const moonlightHint = state.status?.capabilities?.gameStreaming?.moonlightHint || "Open Moonlight on this device for low-latency play.";
          playerMeta.textContent = result.title
            ? result.title + " started on the ToneOS host. " + moonlightHint
            : "Game started on the ToneOS host. " + moonlightHint;
        } catch (error) {
          if (error.message !== "PIN_REQUIRED") {
            playerMeta.textContent = error.message || "ToneOS could not start that game.";
          }
        }
      }

      function renderMovies() {
        movieGrid.hidden = false;
        seriesList.hidden = true;
        sectionTitle.textContent = "Movies";
        movieGrid.replaceChildren();
        const movies = state.library?.sections?.movies || [];
        if (!movies.length) {
          movieGrid.innerHTML = '<p class="muted">No movies have been scanned yet.</p>';
          return;
        }
        movies.forEach((item) => {
          const card = document.createElement("button");
          card.type = "button";
          card.className = "card";
          card.innerHTML = poster(item) + "<strong>" + escapeHtml(item.title) + "</strong><span class='muted'>" + escapeHtml(item.meta || "Movie") + "</span>";
          card.addEventListener("click", () => showDetails(item));
          movieGrid.append(card);
        });
      }

      function renderTv() {
        movieGrid.hidden = true;
        seriesList.hidden = false;
        sectionTitle.textContent = "TV Shows";
        seriesList.replaceChildren();
        const seriesItems = state.library?.tvSeries || [];
        if (!seriesItems.length) {
          seriesList.innerHTML = '<p class="muted">No TV shows have been scanned yet.</p>';
          return;
        }
        seriesItems.forEach((series) => {
          const section = document.createElement("section");
          section.className = "season";
          section.innerHTML = "<h2>" + escapeHtml(series.seriesTitle) + "</h2>";
          series.seasons.forEach((season) => {
            const seasonTitle = document.createElement("p");
            seasonTitle.className = "muted";
            seasonTitle.textContent = "Season " + season.seasonNumber;
            section.append(seasonTitle);
            season.episodes.forEach((episode) => {
              const row = document.createElement("div");
              row.className = "episode";
              row.innerHTML = "<div><strong>" + escapeHtml(episode.title) + "</strong><p class='muted'>" + escapeHtml(episode.meta || "Episode") + "</p></div><button type='button'>Details</button>";
              row.querySelector("button").addEventListener("click", () => showDetails(episode));
              row.addEventListener("click", () => showDetails(episode));
              section.append(row);
            });
          });
          seriesList.append(section);
        });
      }

      function renderGames() {
        movieGrid.hidden = false;
        seriesList.hidden = true;
        sectionTitle.textContent = "Games";
        movieGrid.replaceChildren();
        const games = state.library?.sections?.games || [];
        if (!games.length) {
          movieGrid.innerHTML = '<p class="muted">No games or emulator ROMs have been scanned yet.</p>';
          return;
        }
        games.forEach((item) => {
          const card = document.createElement("div");
          card.className = "card game-launch";
          card.innerHTML = poster(item) + "<strong>" + escapeHtml(item.title) + "</strong><span class='muted'>" + escapeHtml(item.meta || "Host game") + "</span><button type='button'>Details</button>";
          card.querySelector("button").addEventListener("click", (event) => {
            event.stopPropagation();
            showDetails(item);
          });
          card.addEventListener("click", () => showDetails(item));
          movieGrid.append(card);
        });
      }

      function render() {
        tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.section === state.section));
        if (state.section === "tv") {
          renderTv();
        } else if (state.section === "games") {
          renderGames();
        } else {
          renderMovies();
        }
      }

      async function load() {
        try {
          const status = await api("/api/status");
          const qualityMode = status.capabilities?.quality?.sameNetwork === "original" ? "Original quality" : "Adaptive";
          state.status = status;
          serverName.textContent = status.name;
          serverStatus.textContent = status.running ? qualityMode + " direct play ready on this network" : "Server is not running";
          pinPanel.hidden = true;
          state.library = await api("/api/library");
          render();
        } catch (error) {
          if (error.message !== "PIN_REQUIRED") {
            serverStatus.textContent = error.message || "Could not load this server.";
          }
        }
      }

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          state.section = tab.dataset.section;
          detailPanel.hidden = true;
          state.selectedItem = null;
          render();
        });
      });

      detailPlayButton.addEventListener("click", () => {
        if (!state.selectedItem) {
          return;
        }

        if (state.selectedItem.section === "games") {
          launchGame(state.selectedItem);
          return;
        }

        playItem(state.selectedItem);
      });

      detailCloseButton.addEventListener("click", () => {
        state.selectedItem = null;
        detailPanel.hidden = true;
      });

      pinButton.addEventListener("click", () => {
        state.pin = pinInput.value;
        sessionStorage.setItem("toneos.pin", state.pin);
        load();
      });

      pinInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          pinButton.click();
        }
      });

      load();
    </script>
  </body>
</html>`;
}

function createMediaServer({ getLibraryPath, getSettingsPath, loadSettings, handleRemoteCommand }) {
  let httpServer = null;
  let discoverySocket = null;
  let discoveryTimer = null;
  let status = {
    error: "",
    port: 8096,
    running: false,
    startedAt: "",
  };

  async function getSettings() {
    return loadSettings(getSettingsPath());
  }

  function stopDiscovery() {
    if (discoveryTimer) {
      clearInterval(discoveryTimer);
      discoveryTimer = null;
    }

    if (discoverySocket) {
      discoverySocket.close();
      discoverySocket = null;
    }
  }

  function startDiscovery(settings) {
    stopDiscovery();

    if (!settings.mediaServer?.discovery || !status.running) {
      return;
    }

    discoverySocket = dgram.createSocket("udp4");

    const sendBeacon = () => {
      if (!discoverySocket || !status.running) {
        return;
      }

      const payload = Buffer.from(
        JSON.stringify({
          name: settings.mediaServer.name || "ToneOS Media Server",
          port: status.port,
          product: "ToneOS",
          type: "toneos-media-server",
          urls: getClientUrls(status.port),
        }),
      );

      discoverySocket.send(payload, 0, payload.length, DISCOVERY_PORT, DISCOVERY_HOST, () => {});
    };

    discoverySocket.bind(() => {
      discoverySocket.setMulticastTTL(1);
      sendBeacon();
      discoveryTimer = setInterval(sendBeacon, DISCOVERY_INTERVAL_MS);
    });
  }

  async function stop() {
    stopDiscovery();

    if (!httpServer) {
      status = { ...status, running: false };
      return status;
    }

    await new Promise((resolve) => httpServer.close(resolve));
    httpServer = null;
    status = { ...status, error: "", running: false };
    return status;
  }

  async function handleRequest(request, response) {
    const settings = await getSettings();
    const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Headers": "Content-Type, X-ToneOS-PIN",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Origin": "*",
      });
      response.end();
      return;
    }

    if (url.pathname === "/" || url.pathname === "/client") {
      sendText(response, 200, getClientHtml(), "text/html; charset=utf-8");
      return;
    }

    const accessError = getAccessError(request, url, settings);

    if (accessError) {
      sendJson(response, accessError.statusCode, accessError);
      return;
    }

    if (url.pathname === "/api/status") {
      sendJson(response, 200, createStatusPayload(status, settings));
      return;
    }

    if (url.pathname === "/api/library") {
      sendJson(response, 200, createLibraryPayload(await loadLibrary(getLibraryPath())));
      return;
    }

    if (url.pathname === "/api/live-tv") {
      const library = await loadLibrary(getLibraryPath());
      sendJson(response, 200, await loadLiveTvData(settings, library));
      return;
    }

    const artworkMatch = url.pathname.match(/^\/artwork\/([^/]+)\/(cover|backdrop|header)$/);

    if (artworkMatch) {
      const library = await loadLibrary(getLibraryPath());
      const item = findLibraryItem(library, decodeURIComponent(artworkMatch[1]));
      const artworkUrl = item?.[`${decodeURIComponent(artworkMatch[2])}Url`] || "";

      if (!isLocalFileUrl(artworkUrl)) {
        sendJson(response, 404, { code: "ARTWORK_NOT_FOUND", message: "Artwork was not found on the server." });
        return;
      }

      let artworkPath = "";

      try {
        artworkPath = fileURLToPath(artworkUrl);
      } catch {
        sendJson(response, 404, { code: "ARTWORK_NOT_FOUND", message: "Artwork path is invalid." });
        return;
      }

      fs.stat(artworkPath, (statError, stats) => {
        if (statError || !stats.isFile()) {
          sendJson(response, 404, { code: "ARTWORK_NOT_FOUND", message: "Artwork file was not found on the server." });
          return;
        }

        response.writeHead(200, {
          "Cache-Control": "public, max-age=3600",
          "Content-Length": stats.size,
          "Content-Type": IMAGE_MIME_TYPES[path.extname(artworkPath).toLowerCase()] || "application/octet-stream",
        });
        fs.createReadStream(artworkPath).pipe(response);
      });
      return;
    }

    if (url.pathname === "/api/remote" && request.method === "POST") {
      const body = await readRequestBody(request);
      let payload = {};

      try {
        payload = JSON.parse(body);
      } catch {
        payload = {};
      }

      const command = String(payload.command || "").trim();

      if (!command) {
        sendJson(response, 400, { code: "COMMAND_REQUIRED", message: "A remote command is required." });
        return;
      }

      if (typeof handleRemoteCommand !== "function") {
        sendJson(response, 503, { code: "REMOTE_UNAVAILABLE", message: "ToneOS remote control is unavailable." });
        return;
      }

      const result = await handleRemoteCommand({
        command,
        payload: payload.payload || {},
      });

      sendJson(response, result?.ok === false ? 400 : 200, result || { ok: true });
      return;
    }

    if (url.pathname === "/api/pin" && request.method === "POST") {
      const body = await readRequestBody(request);
      let pin = "";
      try {
        pin = JSON.parse(body).pin || "";
      } catch {
        pin = "";
      }
      const requiredPin = String(settings.mediaServer?.pin || "").trim();

      if (requiredPin && pin !== requiredPin) {
        sendJson(response, 401, { code: "PIN_REQUIRED", message: "Invalid PIN." });
        return;
      }

      sendJson(response, 200, { ok: true }, { "Set-Cookie": `toneos_pin=${encodeURIComponent(pin)}; HttpOnly; SameSite=Lax` });
      return;
    }

    const streamMatch = url.pathname.match(/^\/stream\/([^/]+)$/);

    if (streamMatch) {
      const mediaServerSettings = settings.mediaServer || {};
      const remoteAddress = request.socket.remoteAddress || "";
      const isSameNetworkRequest = isSameNetworkAddress(remoteAddress);

      if (mediaServerSettings.directPlay === false) {
        sendJson(response, 409, {
          code: "DIRECT_PLAY_DISABLED",
          message: "Direct play is disabled. FFmpeg transcoding is planned for a later build.",
        });
        return;
      }

      if (isSameNetworkRequest && mediaServerSettings.sameNetworkOriginal === false) {
        sendJson(response, 409, {
          code: "ORIGINAL_QUALITY_DISABLED",
          message: "Original quality is disabled for same-network devices. FFmpeg adaptive streaming is planned for a later build.",
        });
        return;
      }

      if (!isSameNetworkRequest && mediaServerSettings.remoteOriginal === false) {
        sendJson(response, 409, {
          code: "REMOTE_ORIGINAL_DISABLED",
          message: `Remote original quality is disabled. FFmpeg fallback at ${clampMbps(mediaServerSettings.remoteFallbackMbps)} Mbps is planned for a later build.`,
        });
        return;
      }

      const library = await loadLibrary(getLibraryPath());
      const item = findPlayableItem(library, decodeURIComponent(streamMatch[1]));

      if (!item?.path) {
        sendJson(response, 404, { code: "NOT_FOUND", message: "Media item was not found." });
        return;
      }

      fs.stat(item.path, (statError, stats) => {
        if (statError || !stats.isFile()) {
          sendJson(response, 404, { code: "FILE_NOT_FOUND", message: "Media file was not found on the server." });
          return;
        }

        const range = request.headers.range;
        const mimeType = VIDEO_MIME_TYPES[path.extname(item.path).toLowerCase()] || "application/octet-stream";

        if (!range) {
          response.writeHead(200, {
            "Accept-Ranges": "bytes",
            "Content-Length": stats.size,
            "Content-Type": mimeType,
          });
          fs.createReadStream(item.path).pipe(response);
          return;
        }

        const [startText, endText] = range.replace(/bytes=/, "").split("-");
        const start = Number(startText);
        const end = endText ? Number(endText) : stats.size - 1;

        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= stats.size) {
          response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
          response.end();
          return;
        }

        response.writeHead(206, {
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          "Content-Range": `bytes ${start}-${end}/${stats.size}`,
          "Content-Type": mimeType,
        });
        fs.createReadStream(item.path, { end, start }).pipe(response);
      });
      return;
    }

    sendJson(response, 404, { code: "NOT_FOUND", message: "Route not found." });
  }

  async function start(settings) {
    const mediaServerSettings = settings.mediaServer || {};
    const port = clampPort(mediaServerSettings.port);

    await stop();

    if (!mediaServerSettings.enabled) {
      status = { error: "", port, running: false, startedAt: "" };
      return status;
    }

    httpServer = http.createServer((request, response) => {
      handleRequest(request, response).catch((error) => {
        sendJson(response, 500, { code: "SERVER_ERROR", message: error.message || "ToneOS Media Server error." });
      });
    });

    await new Promise((resolve) => {
      httpServer.once("error", (error) => {
        status = {
          error: error.message || "Could not start ToneOS Media Server.",
          port,
          running: false,
          startedAt: "",
        };
        httpServer = null;
        resolve();
      });
      httpServer.listen(port, "0.0.0.0", () => {
        status = {
          error: "",
          port,
          running: true,
          startedAt: new Date().toISOString(),
        };
        resolve();
      });
    });

    startDiscovery(settings);
    return status;
  }

  async function configure(settings) {
    return start(settings);
  }

  async function getStatus() {
    const settings = await getSettings();
    return createStatusPayload(status, settings);
  }

  return {
    configure,
    getStatus,
    start,
    stop,
  };
}

module.exports = {
  createMediaServer,
  getClientUrls,
};
