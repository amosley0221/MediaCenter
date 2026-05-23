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

function getFileKind(filePath, sourceKey) {
  const extension = path.extname(filePath).toLowerCase();

  if (sourceKey === "games" && GAME_EXTENSIONS.has(extension)) {
    return "games";
  }

  if (sourceKey === "books" && BOOK_EXTENSIONS.has(extension)) {
    return "books";
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
    source: "desktop-scan",
    sourceId,
    updatedAt,
  };

  if (!section) {
    return null;
  }

  if (section === "tv") {
    const episode = parseTvEpisode(filePath);

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

async function upsertScannedSource(libraryPath, sourceKey, sourcePaths) {
  const scanResult = await scanSourcePaths(sourceKey, sourcePaths);
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

function createSteamLibraryItems(games = []) {
  return games
    .filter((game) => game.name && !game.error)
    .map((game) => ({
      addedAt: new Date().toISOString(),
      appId: game.appId,
      coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/library_600x900_2x.jpg`,
      headerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/header.jpg`,
      id: `steam:${game.appId}`,
      launchUrl: `steam://rungameid/${game.appId}`,
      meta: "Steam | Installed",
      path: game.installDir,
      section: "games",
      source: "steam",
      sourceId: "steam",
      title: game.name,
      updatedAt: new Date().toISOString(),
    }));
}

async function upsertSteamScan(libraryPath, steamScan) {
  const library = await loadLibrary(libraryPath);
  const steamItems = createSteamLibraryItems(steamScan.games || []);
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
  upsertScannedSource,
  upsertSteamScan,
};
