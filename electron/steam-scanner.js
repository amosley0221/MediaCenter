const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getDefaultSteamRoots() {
  const home = os.homedir();

  if (process.platform === "win32") {
    return uniq([
      process.env.STEAM_HOME,
      process.env.STEAM_DIR,
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Steam"),
      process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Steam"),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Steam"),
      path.join(home, "AppData", "Local", "Steam"),
      "C:\\Program Files (x86)\\Steam",
      "C:\\Program Files\\Steam",
    ]);
  }

  if (process.platform === "darwin") {
    return uniq([
      process.env.STEAM_HOME,
      path.join(home, "Library", "Application Support", "Steam"),
    ]);
  }

  return uniq([
    process.env.STEAM_HOME,
    path.join(home, ".steam", "steam"),
    path.join(home, ".local", "share", "Steam"),
    path.join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"),
  ]);
}

function toSteamAppsDir(rootPath) {
  return path.basename(rootPath).toLowerCase() === "steamapps"
    ? rootPath
    : path.join(rootPath, "steamapps");
}

function readQuotedToken(text, startIndex) {
  let value = "";
  let index = startIndex + 1;

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\\" && (next === "\"" || next === "\\")) {
      value += next;
      index += 2;
      continue;
    }

    if (char === "\"") {
      return { index: index + 1, value };
    }

    value += char;
    index += 1;
  }

  return { index, value };
}

function tokenizeValveKeyValues(text) {
  const tokens = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      index = text.indexOf("\n", index);
      if (index === -1) {
        break;
      }
      continue;
    }

    if (char === "{" || char === "}") {
      tokens.push(char);
      index += 1;
      continue;
    }

    if (char === "\"") {
      const token = readQuotedToken(text, index);
      tokens.push(token.value);
      index = token.index;
      continue;
    }

    let value = "";
    while (index < text.length && !/\s|[{}]/.test(text[index])) {
      value += text[index];
      index += 1;
    }
    tokens.push(value);
  }

  return tokens;
}

function parseValveObject(tokens, startIndex = 0) {
  const output = {};
  let index = startIndex;

  while (index < tokens.length) {
    const key = tokens[index];

    if (key === "}") {
      return { index: index + 1, value: output };
    }

    index += 1;

    if (tokens[index] === "{") {
      const nested = parseValveObject(tokens, index + 1);
      output[key] = nested.value;
      index = nested.index;
      continue;
    }

    output[key] = tokens[index] || "";
    index += 1;
  }

  return { index, value: output };
}

function parseValveKeyValues(text) {
  const tokens = tokenizeValveKeyValues(text);

  if (tokens[1] === "{") {
    return {
      [tokens[0]]: parseValveObject(tokens, 2).value,
    };
  }

  return parseValveObject(tokens).value;
}

function extractLibraryRoots(libraryFoldersVdf) {
  const parsed = parseValveKeyValues(libraryFoldersVdf);
  const libraryFolders = parsed.libraryfolders || parsed.LibraryFolders || parsed;
  const roots = [];

  Object.entries(libraryFolders).forEach(([key, value]) => {
    if (!/^\d+$/.test(key)) {
      return;
    }

    if (typeof value === "string") {
      roots.push(value);
      return;
    }

    if (value && typeof value.path === "string") {
      roots.push(value.path);
    }
  });

  return roots;
}

async function readSteamLibraryDirs(steamAppsDir) {
  const libraryFile = path.join(steamAppsDir, "libraryfolders.vdf");

  if (!(await pathExists(libraryFile))) {
    return [];
  }

  const libraryFolders = await fs.readFile(libraryFile, "utf8");
  return extractLibraryRoots(libraryFolders).map(toSteamAppsDir);
}

async function scanSteamAppManifests(steamAppsDir) {
  let entries = [];

  try {
    entries = await fs.readdir(steamAppsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const manifestFiles = entries
    .filter((entry) => entry.isFile() && /^appmanifest_\d+\.acf$/i.test(entry.name))
    .map((entry) => path.join(steamAppsDir, entry.name));

  const games = [];

  for (const manifestFile of manifestFiles) {
    try {
      const manifest = parseValveKeyValues(await fs.readFile(manifestFile, "utf8"));
      const appState = manifest.AppState || manifest.appstate || manifest;
      const name = appState.name || `Steam App ${appState.appid || ""}`.trim();
      const installDir = appState.installdir
        ? path.join(steamAppsDir, "common", appState.installdir)
        : "";

      games.push({
        appId: appState.appid || path.basename(manifestFile).replace(/\D/g, ""),
        installDir,
        manifestPath: manifestFile,
        name,
        sizeOnDisk: Number(appState.SizeOnDisk || appState.sizeondisk || 0),
        steamAppsPath: steamAppsDir,
      });
    } catch (error) {
      games.push({
        appId: path.basename(manifestFile).replace(/\D/g, ""),
        error: error.message,
        manifestPath: manifestFile,
        name: "Unreadable Steam app",
        steamAppsPath: steamAppsDir,
      });
    }
  }

  return games.sort((a, b) => a.name.localeCompare(b.name));
}

async function scanSteamLibraries(extraRoots = []) {
  const checkedPaths = [];
  const candidates = uniq([...extraRoots, ...getDefaultSteamRoots()].map(toSteamAppsDir));
  const discoveredSteamAppsDirs = new Set();

  for (const steamAppsDir of candidates) {
    checkedPaths.push(steamAppsDir);

    if (!(await pathExists(steamAppsDir))) {
      continue;
    }

    discoveredSteamAppsDirs.add(steamAppsDir);
    const linkedLibraries = await readSteamLibraryDirs(steamAppsDir);
    linkedLibraries.forEach((libraryDir) => discoveredSteamAppsDirs.add(libraryDir));
  }

  const libraries = [];
  const allGames = [];

  for (const steamAppsDir of discoveredSteamAppsDirs) {
    const games = await scanSteamAppManifests(steamAppsDir);

    libraries.push({
      gameCount: games.length,
      games,
      path: path.dirname(steamAppsDir),
      steamAppsPath: steamAppsDir,
    });

    allGames.push(...games);
  }

  return {
    checkedPaths,
    gameCount: allGames.length,
    games: allGames,
    libraries: libraries.sort((a, b) => a.steamAppsPath.localeCompare(b.steamAppsPath)),
    scannedAt: new Date().toISOString(),
  };
}

module.exports = {
  extractLibraryRoots,
  parseValveKeyValues,
  scanSteamLibraries,
};
