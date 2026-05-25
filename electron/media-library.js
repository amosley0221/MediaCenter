const fs = require("node:fs/promises");
const path = require("node:path");

const VIDEO_EXTENSIONS = new Set([
  ".avi",
  ".m2ts",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ts",
  ".webm",
  ".wmv",
]);

const AUDIO_EXTENSIONS = new Set([
  ".aac",
  ".aiff",
  ".alac",
  ".flac",
  ".m4a",
  ".mp3",
  ".ogg",
  ".opus",
  ".wav",
  ".wma",
]);

const BOOK_EXTENSIONS = new Set([
  ".azw",
  ".azw3",
  ".cbr",
  ".cbz",
  ".epub",
  ".mobi",
  ".pdf",
]);

const GAME_EXTENSIONS = new Set([".app", ".bat", ".cmd", ".desktop", ".exe", ".lnk", ".sh", ".url"]);
const ROM_EXTENSIONS = new Set([
  ".3ds",
  ".7z",
  ".a26",
  ".a52",
  ".a78",
  ".bin",
  ".cdi",
  ".cue",
  ".fds",
  ".gb",
  ".gba",
  ".gbc",
  ".gcm",
  ".gen",
  ".gg",
  ".iso",
  ".md",
  ".nds",
  ".nes",
  ".n64",
  ".pbp",
  ".sfc",
  ".sms",
  ".smc",
  ".wad",
  ".wbfs",
  ".xci",
  ".z64",
  ".zip",
]);
const IGNORED_DIRECTORIES = new Set([
  "$recycle.bin",
  ".cache",
  ".git",
  ".svn",
  "appdata",
  "cache",
  "dist",
  "node_modules",
  "system volume information",
  "windows",
]);
const MAX_SCAN_DEPTH = 8;
const MAX_SCAN_ITEMS = 5000;
const MAX_METADATA_LOOKUPS = 24;
const MAX_METADATA_REFRESH_LOOKUPS = 300;
const MUSICBRAINZ_USER_AGENT = "MediaCenter/0.1.0 (personal desktop media library)";

function createEmptyLibrary() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sources: [],
    sections: {
      books: [],
      games: [],
      movies: [],
      music: [],
      tv: [],
    },
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadLibrary(libraryPath) {
  if (!(await pathExists(libraryPath))) {
    return createEmptyLibrary();
  }

  try {
    const parsed = JSON.parse(await fs.readFile(libraryPath, "utf8"));
    return {
      ...createEmptyLibrary(),
      ...parsed,
      sections: {
        ...createEmptyLibrary().sections,
        ...(parsed.sections || {}),
      },
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch {
    return createEmptyLibrary();
  }
}

async function saveLibrary(libraryPath, library) {
  await fs.mkdir(path.dirname(libraryPath), { recursive: true });
  const nextLibrary = {
    ...library,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(libraryPath, `${JSON.stringify(nextLibrary, null, 2)}\n`);
  return nextLibrary;
}

function normalizePathList(paths) {
  return [...new Set((Array.isArray(paths) ? paths : [paths]).filter(Boolean).map(path.normalize))];
}

function getSourceId(sourceKey, paths) {
  return `${sourceKey}:${normalizePathList(paths).join("|")}`;
}

function formatBytes(bytes = 0) {
  if (!bytes) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function toTitleCase(text) {
  return text
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) {
        return word;
      }

      return `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function cleanMediaTitle(filePath) {
  const extension = path.extname(filePath);
  const baseName = path.basename(filePath, extension);
  const cleaned = baseName
    .replace(/[._]+/g, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]*(1080p|2160p|720p|x265|x264|bluray|web-dl|webrip|hdr|dv)[^)]*\)/gi, " ")
    .replace(/\b(480p|720p|1080p|2160p|4k|8k|bluray|blu ray|web-dl|webdl|webrip|hdr|dv|x264|x265|h264|h265|aac|dts|atmos)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return toTitleCase(cleaned || baseName || path.basename(filePath));
}

function cleanProviderQuery(title = "") {
  return title
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

function getTmdbPosterUrl(pathValue) {
  return pathValue ? `https://image.tmdb.org/t/p/w500${pathValue}` : "";
}

function getTmdbBackdropUrl(pathValue) {
  return pathValue ? `https://image.tmdb.org/t/p/w780${pathValue}` : "";
}

async function getTmdbMetadata(item, mediaType, metadataSettings) {
  const apiKey = metadataSettings.tmdbApiKey?.trim();

  if (!metadataSettings.tmdbEnabled || !apiKey) {
    return null;
  }

  const queryTitle = mediaType === "tv" ? item.seriesTitle || item.title : item.title;
  const query = encodeURIComponent(cleanProviderQuery(queryTitle));
  const data = await fetchJson(
    `https://api.themoviedb.org/3/search/${mediaType}?api_key=${encodeURIComponent(apiKey)}&query=${query}&include_adult=false`,
  );
  const result = data?.results?.[0];

  if (!result) {
    return null;
  }

  const year = String(result.release_date || result.first_air_date || "").slice(0, 4);

  return {
    backdropUrl: getTmdbBackdropUrl(result.backdrop_path),
    coverUrl: getTmdbPosterUrl(result.poster_path),
    metadata: {
      overview: result.overview || "",
      provider: "TMDb",
      providerId: result.id,
      rating: result.vote_average || null,
      year,
    },
    meta:
      mediaType === "tv"
        ? `${item.meta || "TV"}${year ? ` | ${year}` : ""}`
        : `${year || item.extension || "Movie"} | TMDb`,
    title: mediaType === "tv" ? item.title : result.title || result.name || item.title,
  };
}

async function getRawgMetadata(item, metadataSettings) {
  const apiKey = metadataSettings.rawgApiKey?.trim();

  if (!metadataSettings.rawgEnabled || !apiKey) {
    return null;
  }

  const data = await fetchJson(
    `https://api.rawg.io/api/games?key=${encodeURIComponent(apiKey)}&search=${encodeURIComponent(cleanProviderQuery(item.title))}&page_size=1`,
  );
  const result = data?.results?.[0];

  if (!result) {
    return null;
  }

  return {
    coverUrl: result.background_image || item.coverUrl,
    metadata: {
      provider: "RAWG",
      providerId: result.id,
      rating: result.rating || null,
      released: result.released || "",
    },
    meta: `${result.released ? String(result.released).slice(0, 4) : "Game"} | RAWG`,
    title: result.name || item.title,
  };
}

async function getOpenLibraryMetadata(item, metadataSettings) {
  if (!metadataSettings.openLibraryEnabled) {
    return null;
  }

  const data = await fetchJson(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanProviderQuery(item.title))}&limit=1`,
  );
  const result = data?.docs?.[0];

  if (!result) {
    return null;
  }

  const author = result.author_name?.[0] || "";

  return {
    coverUrl: result.cover_i ? `https://covers.openlibrary.org/b/id/${result.cover_i}-L.jpg` : item.coverUrl,
    metadata: {
      author,
      provider: "Open Library",
      providerId: result.key || "",
      year: result.first_publish_year || null,
    },
    meta: `${author || "Book"}${result.first_publish_year ? ` | ${result.first_publish_year}` : ""}`,
    title: result.title || item.title,
  };
}

async function getMusicBrainzMetadata(item, metadataSettings) {
  if (!metadataSettings.musicBrainzEnabled) {
    return null;
  }

  const query = [`recording:"${item.title}"`];

  if (item.artist && item.artist !== "Local Music") {
    query.push(`artist:"${item.artist}"`);
  }

  const data = await fetchJson(
    `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query.join(" AND "))}&fmt=json&limit=1`,
    { "User-Agent": MUSICBRAINZ_USER_AGENT },
  );
  const result = data?.recordings?.[0];

  if (!result) {
    return null;
  }

  const artist = result["artist-credit"]?.map((credit) => credit.name).filter(Boolean).join(", ");

  return {
    metadata: {
      provider: "MusicBrainz",
      providerId: result.id,
      score: result.score || null,
    },
    meta: `${artist || item.artist || "Music"} | MusicBrainz`,
    title: result.title || item.title,
  };
}

async function getMetadataForItem(item, metadataSettings = {}) {
  try {
    if (item.section === "movies") {
      return getTmdbMetadata(item, "movie", metadataSettings);
    }

    if (item.section === "tv") {
      return getTmdbMetadata(item, "tv", metadataSettings);
    }

    if (item.section === "games") {
      return getRawgMetadata(item, metadataSettings);
    }

    if (item.section === "books") {
      return getOpenLibraryMetadata(item, metadataSettings);
    }

    if (item.section === "music") {
      return getMusicBrainzMetadata(item, metadataSettings);
    }
  } catch {
    return null;
  }

  return null;
}

function canFetchMetadataForItem(item, metadataSettings = {}) {
  if (item.section === "movies" || item.section === "tv") {
    return Boolean(metadataSettings.tmdbEnabled && metadataSettings.tmdbApiKey?.trim());
  }

  if (item.section === "games") {
    return Boolean(metadataSettings.rawgEnabled && metadataSettings.rawgApiKey?.trim());
  }

  if (item.section === "books") {
    return Boolean(metadataSettings.openLibraryEnabled);
  }

  if (item.section === "music") {
    return Boolean(metadataSettings.musicBrainzEnabled);
  }

  return false;
}

function getMetadataLookupTitle(item) {
  return item.section === "tv" ? item.seriesTitle || item.title : item.title;
}

function getMetadataCacheKey(item) {
  return `${item.section}:${cleanProviderQuery(getMetadataLookupTitle(item)).toLowerCase()}`;
}

function formatCachedMetadataForItem(item, metadata) {
  if (!metadata) {
    return null;
  }

  if (item.section === "tv" && metadata.metadata?.provider === "TMDb") {
    const year = metadata.metadata.year;
    return {
      ...metadata,
      meta: `${item.meta || "TV"}${year ? ` | ${year}` : ""}`,
      title: item.title,
    };
  }

  return metadata;
}

function hasMetadataArtwork(item) {
  return Boolean(item.coverUrl || item.backdropUrl || item.headerUrl);
}

function didMetadataChange(previousItem = {}, nextItem = {}) {
  const fields = ["backdropUrl", "coverUrl", "headerUrl", "meta", "title"];

  if (fields.some((field) => (previousItem[field] || "") !== (nextItem[field] || ""))) {
    return true;
  }

  return JSON.stringify(previousItem.metadata || {}) !== JSON.stringify(nextItem.metadata || {});
}

async function enrichItemsWithMetadata(items, metadataSettings = {}, options = {}) {
  const enrichedItems = [];
  let lookupCount = 0;
  const lookupCache = options.lookupCache || new Map();
  const maxLookups = options.maxLookups ?? MAX_METADATA_LOOKUPS;
  const force = Boolean(options.force);

  for (const item of items) {
    if (!canFetchMetadataForItem(item, metadataSettings) || (!force && hasMetadataArtwork(item))) {
      enrichedItems.push(item);
      continue;
    }

    const cacheKey = getMetadataCacheKey(item);

    if (lookupCache.has(cacheKey)) {
      const metadata = formatCachedMetadataForItem(item, lookupCache.get(cacheKey));
      enrichedItems.push(metadata ? { ...item, ...metadata } : item);
      continue;
    }

    if (lookupCount >= maxLookups) {
      enrichedItems.push(item);
      continue;
    }

    lookupCount += 1;
    const metadata = await getMetadataForItem(item, metadataSettings);
    lookupCache.set(cacheKey, metadata);
    enrichedItems.push(metadata ? { ...item, ...formatCachedMetadataForItem(item, metadata) } : item);
  }

  return enrichedItems;
}

async function refreshLibraryMetadata(libraryPath, metadataSettings = {}) {
  const library = await loadLibrary(libraryPath);
  const lookupCache = new Map();
  const nextSections = {};
  const summary = {
    scanned: 0,
    updated: 0,
  };

  for (const [section, items] of Object.entries(library.sections || createEmptyLibrary().sections)) {
    const enrichedItems = await enrichItemsWithMetadata(items, metadataSettings, {
      force: true,
      lookupCache,
      maxLookups: MAX_METADATA_REFRESH_LOOKUPS,
    });

    summary.scanned += items.length;
    summary.updated += enrichedItems.filter((item, index) => didMetadataChange(items[index], item)).length;
    nextSections[section] = enrichedItems;
  }

  const savedLibrary = await saveLibrary(libraryPath, {
    ...library,
    sections: {
      ...createEmptyLibrary().sections,
      ...nextSections,
    },
  });

  return {
    library: savedLibrary,
    summary,
  };
}

function parseTvEpisode(filePath) {
  const extension = path.extname(filePath);
  const baseName = path.basename(filePath, extension);
  const seasonEpisodeMatch =
    baseName.match(/^(.*?)[\s._-]+s(\d{1,2})[\s._-]*e(\d{1,3})(?:[\s._-]|$)/i) ||
    baseName.match(/^(.*?)[\s._-]+(\d{1,2})x(\d{1,3})(?:[\s._-]|$)/i);

  if (!seasonEpisodeMatch) {
    return null;
  }

  const [, seriesName, seasonNumber, episodeNumber] = seasonEpisodeMatch;
  const episodeTitle = baseName
    .slice(seasonEpisodeMatch[0].length)
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    episodeNumber: Number(episodeNumber),
    episodeTitle: episodeTitle ? toTitleCase(episodeTitle) : `Episode ${Number(episodeNumber)}`,
    seasonNumber: Number(seasonNumber),
    seriesTitle: toTitleCase(seriesName.replace(/[._-]+/g, " ").trim() || path.basename(path.dirname(filePath))),
  };
}

function parseMusicTrack(filePath) {
  const baseTitle = cleanMediaTitle(filePath);
  const parent = path.basename(path.dirname(filePath));
  const grandParent = path.basename(path.dirname(path.dirname(filePath)));
  const artistTitle = baseTitle.match(/^(.*?)\s+-\s+(.*)$/);

  if (artistTitle) {
    return {
      album: toTitleCase(parent),
      artist: toTitleCase(artistTitle[1]),
      title: toTitleCase(artistTitle[2]),
    };
  }

  return {
    album: toTitleCase(parent),
    artist: grandParent && grandParent !== "." ? toTitleCase(grandParent) : "Local Music",
    title: baseTitle,
  };
}

function inferEmulatorPlatform(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const folderText = path
    .dirname(filePath)
    .split(path.sep)
    .slice(-3)
    .join(" ")
    .toLowerCase();
  const extensionPlatforms = {
    ".3ds": "Nintendo 3DS",
    ".a26": "Atari 2600",
    ".a52": "Atari 5200",
    ".a78": "Atari 7800",
    ".cdi": "Dreamcast",
    ".fds": "Famicom Disk System",
    ".gb": "Game Boy",
    ".gba": "Game Boy Advance",
    ".gbc": "Game Boy Color",
    ".gcm": "GameCube",
    ".gen": "Sega Genesis",
    ".gg": "Game Gear",
    ".md": "Sega Genesis",
    ".nds": "Nintendo DS",
    ".nes": "NES",
    ".n64": "Nintendo 64",
    ".pbp": "PlayStation Portable",
    ".sfc": "Super Nintendo",
    ".sms": "Sega Master System",
    ".smc": "Super Nintendo",
    ".wad": "Wii",
    ".wbfs": "Wii",
    ".xci": "Nintendo Switch",
    ".z64": "Nintendo 64",
  };
  const folderPlatforms = [
    ["switch", "Nintendo Switch"],
    ["gamecube", "GameCube"],
    ["game cube", "GameCube"],
    ["dreamcast", "Dreamcast"],
    ["playstation portable", "PlayStation Portable"],
    ["psp", "PlayStation Portable"],
    ["playstation 2", "PlayStation 2"],
    ["ps2", "PlayStation 2"],
    ["playstation", "PlayStation"],
    ["ps1", "PlayStation"],
    ["nintendo 64", "Nintendo 64"],
    ["n64", "Nintendo 64"],
    ["super nintendo", "Super Nintendo"],
    ["snes", "Super Nintendo"],
    ["game boy advance", "Game Boy Advance"],
    ["gba", "Game Boy Advance"],
    ["game boy color", "Game Boy Color"],
    ["gbc", "Game Boy Color"],
    ["game boy", "Game Boy"],
    ["gb", "Game Boy"],
    ["nintendo ds", "Nintendo DS"],
    ["nds", "Nintendo DS"],
    ["nintendo 3ds", "Nintendo 3DS"],
    ["3ds", "Nintendo 3DS"],
    ["genesis", "Sega Genesis"],
    ["mega drive", "Sega Genesis"],
    ["nes", "NES"],
    ["wii", "Wii"],
  ];

  return folderPlatforms.find(([needle]) => folderText.includes(needle))?.[1] || extensionPlatforms[extension] || "Emulator";
}

function getFileKind(filePath, sourceKey) {
  const extension = path.extname(filePath).toLowerCase();

  if (sourceKey === "emulators" && ROM_EXTENSIONS.has(extension)) {
    return "games";
  }

  if (sourceKey === "games" && GAME_EXTENSIONS.has(extension)) {
    return "games";
  }

  if (sourceKey === "books" && BOOK_EXTENSIONS.has(extension)) {
    return "books";
  }

  if (sourceKey === "movies" && VIDEO_EXTENSIONS.has(extension)) {
    return "movies";
  }

  if (sourceKey === "tv" && VIDEO_EXTENSIONS.has(extension)) {
    return "tv";
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return parseTvEpisode(filePath) ? "tv" : "movies";
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return "music";
  }

  if (BOOK_EXTENSIONS.has(extension)) {
    return "books";
  }

  if (GAME_EXTENSIONS.has(extension)) {
    return "games";
  }

  return null;
}

function inferTvEpisode(filePath) {
  const seasonFolderMatch = path.basename(path.dirname(filePath)).match(/season[\s._-]*(\d{1,2})/i);
  const seriesFolder = seasonFolderMatch
    ? path.basename(path.dirname(path.dirname(filePath)))
    : path.basename(path.dirname(filePath));

  return {
    episodeNumber: 1,
    episodeTitle: cleanMediaTitle(filePath),
    seasonNumber: seasonFolderMatch ? Number(seasonFolderMatch[1]) : 1,
    seriesTitle: toTitleCase(seriesFolder.replace(/[._-]+/g, " ").trim() || cleanMediaTitle(filePath)),
  };
}

function createScannedItem(filePath, sourceKey, sourceId, stats) {
  const extension = path.extname(filePath).toLowerCase();
  const section = getFileKind(filePath, sourceKey);
  const addedAt = stats.birthtime?.toISOString?.() || stats.mtime?.toISOString?.() || new Date().toISOString();
  const updatedAt = stats.mtime?.toISOString?.() || addedAt;
  const baseItem = {
    addedAt,
    extension: extension.replace(".", "").toUpperCase(),
    fileSize: stats.size,
    id: `${sourceId}:${filePath}`,
    path: filePath,
    section,
    source: sourceKey === "emulators" ? "emulator" : "desktop-scan",
    sourceId,
    updatedAt,
  };

  if (!section) {
    return null;
  }

  if (section === "tv") {
    const episode = parseTvEpisode(filePath) || inferTvEpisode(filePath);

    return {
      ...baseItem,
      episodeNumber: episode.episodeNumber,
      meta: `S${String(episode.seasonNumber).padStart(2, "0")} E${String(episode.episodeNumber).padStart(2, "0")} | Local`,
      seasonNumber: episode.seasonNumber,
      seriesTitle: episode.seriesTitle,
      title: episode.episodeTitle,
    };
  }

  if (section === "music") {
    const track = parseMusicTrack(filePath);

    return {
      ...baseItem,
      album: track.album,
      artist: track.artist,
      meta: `${track.artist} | ${track.album}`,
      title: track.title,
    };
  }

  if (section === "games") {
    if (sourceKey === "emulators") {
      const platform = inferEmulatorPlatform(filePath);

      return {
        ...baseItem,
        emulatorPlatform: platform,
        launchPath: filePath,
        meta: `${platform} | ROM`,
        title: cleanMediaTitle(filePath),
      };
    }

    return {
      ...baseItem,
      launchPath: filePath,
      meta: `Local game | ${extension.replace(".", "").toUpperCase() || "App"}`,
      title: cleanMediaTitle(filePath),
    };
  }

  return {
    ...baseItem,
    meta: `${baseItem.extension || "File"} | ${formatBytes(stats.size) || "Local"}`,
    title: cleanMediaTitle(filePath),
  };
}

async function scanFile(filePath, sourceKey, sourceId, output) {
  const stats = await fs.stat(filePath);

  if (stats.isDirectory()) {
    await scanDirectory(filePath, sourceKey, sourceId, output, 0);
    return;
  }

  if (!stats.isFile()) {
    return;
  }

  const item = createScannedItem(filePath, sourceKey, sourceId, stats);

  if (item) {
    output.push(item);
  }
}

async function scanDirectory(rootPath, sourceKey, sourceId, output, depth) {
  if (depth > MAX_SCAN_DEPTH || output.length >= MAX_SCAN_ITEMS) {
    return;
  }

  let entries = [];

  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (output.length >= MAX_SCAN_ITEMS) {
      return;
    }

    const entryPath = path.join(rootPath, entry.name);
    const entryName = entry.name.toLowerCase();

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entryName)) {
        await scanDirectory(entryPath, sourceKey, sourceId, output, depth + 1);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = await fs.stat(entryPath);
    const item = createScannedItem(entryPath, sourceKey, sourceId, stats);

    if (item) {
      output.push(item);
    }
  }
}

function summarizeItems(items) {
  return items.reduce(
    (summary, item) => {
      summary.total += 1;
      summary[item.section] += 1;
      return summary;
    },
    { books: 0, games: 0, movies: 0, music: 0, total: 0, tv: 0 },
  );
}

async function scanSourcePaths(sourceKey, sourcePaths) {
  const paths = normalizePathList(sourcePaths);
  const sourceId = getSourceId(sourceKey, paths);
  const items = [];

  for (const sourcePath of paths) {
    try {
      await scanFile(sourcePath, sourceKey, sourceId, items);
    } catch {
      // Keep scanning the other selected paths.
    }
  }

  return {
    items,
    paths,
    scannedAt: new Date().toISOString(),
    sourceId,
    sourceKey,
    summary: summarizeItems(items),
  };
}

async function upsertScannedSource(libraryPath, sourceKey, sourcePaths, metadataSettings = {}) {
  const scanResult = await scanSourcePaths(sourceKey, sourcePaths);
  scanResult.items = await enrichItemsWithMetadata(scanResult.items, metadataSettings);
  const library = await loadLibrary(libraryPath);
  const nextSources = library.sources.filter((source) => source.id !== scanResult.sourceId);
  const nextSections = Object.fromEntries(
    Object.entries(library.sections).map(([section, items]) => [
      section,
      items.filter((item) => item.sourceId !== scanResult.sourceId),
    ]),
  );

  scanResult.items.forEach((item) => {
    nextSections[item.section].push(item);
  });

  const savedLibrary = await saveLibrary(libraryPath, {
    ...library,
    sections: nextSections,
    sources: [
      {
        id: scanResult.sourceId,
        itemCount: scanResult.summary.total,
        paths: scanResult.paths,
        scannedAt: scanResult.scannedAt,
        sourceKey,
        summary: scanResult.summary,
      },
      ...nextSources,
    ],
  });

  return {
    ...scanResult,
    library: savedLibrary,
  };
}

function createSteamLibraryItems(games = [], metadataSettings = {}) {
  return games
    .filter((game) => game.name && !game.error)
    .map((game) => {
      const item = {
        addedAt: new Date().toISOString(),
        appId: game.appId,
        id: `steam:${game.appId}`,
        launchUrl: `steam://rungameid/${game.appId}`,
        meta: "Steam | Installed",
        path: game.installDir,
        section: "games",
        source: "steam",
        sourceId: "steam",
        title: game.name,
        updatedAt: new Date().toISOString(),
      };

      if (metadataSettings.steamArtworkEnabled !== false) {
        item.coverUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/library_600x900_2x.jpg`;
        item.headerUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/header.jpg`;
      }

      return item;
    });
}

async function upsertSteamScan(libraryPath, steamScan, metadataSettings = {}) {
  const library = await loadLibrary(libraryPath);
  const steamItems = createSteamLibraryItems(steamScan.games || [], metadataSettings);
  const nextSources = library.sources.filter((source) => source.id !== "steam");
  const nextSections = {
    ...library.sections,
    games: [
      ...library.sections.games.filter((item) => item.sourceId !== "steam"),
      ...steamItems,
    ],
  };

  const savedLibrary = await saveLibrary(libraryPath, {
    ...library,
    sections: nextSections,
    sources: [
      {
        id: "steam",
        itemCount: steamItems.length,
        paths: (steamScan.libraries || []).map((item) => item.steamAppsPath || item.path).filter(Boolean),
        scannedAt: steamScan.scannedAt || new Date().toISOString(),
        sourceKey: "steam",
        summary: { books: 0, games: steamItems.length, movies: 0, music: 0, total: steamItems.length, tv: 0 },
      },
      ...nextSources,
    ],
  });

  return {
    ...steamScan,
    library: savedLibrary,
  };
}

module.exports = {
  loadLibrary,
  refreshLibraryMetadata,
  upsertScannedSource,
  upsertSteamScan,
};
