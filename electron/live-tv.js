const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_YOUTUBE_TV_URL = "https://tv.youtube.com/";
const DEFAULT_SLOT_MINUTES = 30;

function splitLines(value = "") {
  return [
    ...new Set(
      String(value)
        .split(/\r?\n+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

function cleanText(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value, fallback = "") {
  const text = cleanText(value || fallback);
  return text.length > 82 ? `${text.slice(0, 79)}...` : text;
}

function getPublicId(item) {
  return crypto.createHash("sha256").update(item.id || item.path || item.title || "").digest("base64url").slice(0, 28);
}

function normalizeUrl(value = "", fallback = "") {
  const entry = String(value || "").trim();

  if (!entry) {
    return fallback;
  }

  if (/^https?:\/\//i.test(entry)) {
    return entry;
  }

  return `http://${entry}`;
}

function normalizeBaseUrl(value = "") {
  return normalizeUrl(value).replace(/\/+$/, "");
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "*/*",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText || "request failed"}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, { ...options, headers: { Accept: "application/json", ...(options.headers || {}) } }));
}

async function readTextSource(source = "") {
  const trimmedSource = String(source || "").trim();

  if (!trimmedSource) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmedSource)) {
    return fetchText(trimmedSource);
  }

  return fs.readFile(path.resolve(trimmedSource), "utf8");
}

function parseM3uAttributes(value = "") {
  const attributes = {};
  const attrPattern = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
  let match = attrPattern.exec(value);

  while (match) {
    attributes[match[1]] = cleanText(match[2]);
    match = attrPattern.exec(value);
  }

  return attributes;
}

function parseM3uPlaylist(text = "") {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const channels = [];
  let pendingInfo = null;

  lines.forEach((line) => {
    if (!line) {
      return;
    }

    if (line.startsWith("#EXTINF")) {
      const commaIndex = line.indexOf(",");
      const infoText = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
      const displayName = commaIndex >= 0 ? line.slice(commaIndex + 1) : "";
      const attributes = parseM3uAttributes(infoText);
      pendingInfo = {
        group: attributes["group-title"] || "",
        id: attributes["tvg-id"] || attributes["channel-id"] || attributes["CUID"] || "",
        logo: attributes["tvg-logo"] || "",
        name: attributes["tvg-name"] || displayName || attributes.name || "Live Channel",
      };
      return;
    }

    if (line.startsWith("#")) {
      return;
    }

    if (pendingInfo) {
      channels.push({
        ...pendingInfo,
        id: pendingInfo.id || crypto.createHash("sha1").update(`${pendingInfo.name}:${line}`).digest("hex").slice(0, 12),
        streamUrl: line,
      });
      pendingInfo = null;
    }
  });

  return channels;
}

function parseXmltvDate(value = "") {
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}))?/);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, offset = "+0000"] = match;
  const normalizedOffset = `${offset.slice(0, 3)}:${offset.slice(3)}`;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${normalizedOffset}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getXmlAttribute(tag = "", name = "") {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1] || "";
}

function getXmlNodeText(block = "", nodeName = "") {
  const match = block.match(new RegExp(`<${nodeName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${nodeName}>`, "i"));
  return cleanText(match?.[1] || "");
}

function parseXmltvGuide(text = "") {
  const channelNames = new Map();
  const programsByChannel = new Map();
  const channelPattern = /<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi;
  const programPattern = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
  let channelMatch = channelPattern.exec(text);
  let programMatch = programPattern.exec(text);

  while (channelMatch) {
    const id = getXmlAttribute(channelMatch[1], "id");
    const name = getXmlNodeText(channelMatch[2], "display-name") || id;

    if (id) {
      channelNames.set(id, name);
    }

    channelMatch = channelPattern.exec(text);
  }

  while (programMatch) {
    const attrs = programMatch[1];
    const channelId = getXmlAttribute(attrs, "channel");
    const start = parseXmltvDate(getXmlAttribute(attrs, "start"));
    const stop = parseXmltvDate(getXmlAttribute(attrs, "stop"));

    if (channelId && start && stop) {
      const programs = programsByChannel.get(channelId) || [];
      programs.push({
        channelId,
        description: getXmlNodeText(programMatch[2], "desc"),
        start,
        stop,
        title: getXmlNodeText(programMatch[2], "title") || channelNames.get(channelId) || "Live Program",
      });
      programsByChannel.set(channelId, programs);
    }

    programMatch = programPattern.exec(text);
  }

  programsByChannel.forEach((programs) => {
    programs.sort((a, b) => a.start - b.start);
  });

  return { channelNames, programsByChannel };
}

function getCurrentAndNextProgram(programs = [], now = new Date()) {
  const current = programs.find((program) => program.start <= now && program.stop > now) || null;
  const next = programs.find((program) => program.start > now) || null;
  return { current, next };
}

function formatTimeRange(program) {
  if (!program?.start || !program?.stop) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
  return `${formatter.format(program.start)}-${formatter.format(program.stop)}`;
}

function createLiveCard(channel, program = null, extra = {}) {
  const title = compactText(program?.title || channel.nowTitle || channel.name || "Live Channel");
  const channelName = cleanText(channel.name || channel.channelName || title);
  const timeText = formatTimeRange(program);
  const detailParts = [channelName, timeText, channel.group || channel.number || ""].filter(Boolean);

  return {
    brand: channel.brand || "live-tv",
    channelName,
    coverUrl: channel.logo || channel.coverUrl || "",
    meta: detailParts.join(" | ") || "Live TV",
    sourceType: channel.sourceType || "live",
    status: "Live",
    streamUrl: channel.streamUrl || "",
    target: channel.target || "",
    title,
    ...extra,
  };
}

async function loadHdHomeRunChannels(settings, messages) {
  const liveTv = settings.liveTv || {};

  if (!liveTv.hdHomeRunEnabled || !liveTv.hdHomeRunUrl) {
    return [];
  }

  try {
    const baseUrl = normalizeBaseUrl(liveTv.hdHomeRunUrl);
    const lineup = await fetchJson(`${baseUrl}/lineup.json`);

    return (Array.isArray(lineup) ? lineup : [])
      .filter((channel) => channel.URL && !channel.DRM)
      .map((channel) => ({
        brand: "live-tv",
        name: cleanText(channel.GuideName || channel.Name || `Channel ${channel.GuideNumber || ""}`),
        number: cleanText(channel.GuideNumber || ""),
        sourceType: "HDHomeRun",
        streamUrl: channel.URL,
      }));
  } catch (error) {
    messages.push(`HDHomeRun guide: ${error.message}`);
    return [];
  }
}

async function loadM3uChannels(settings, messages) {
  const liveTv = settings.liveTv || {};

  if (!liveTv.m3uEnabled || !liveTv.m3uSource) {
    return [];
  }

  try {
    return parseM3uPlaylist(await readTextSource(liveTv.m3uSource)).map((channel) => ({
      ...channel,
      brand: "live-tv",
      sourceType: "M3U",
    }));
  } catch (error) {
    messages.push(`M3U playlist: ${error.message}`);
    return [];
  }
}

async function loadXmltvGuide(settings, messages) {
  const liveTv = settings.liveTv || {};

  if (!liveTv.xmltvEnabled || !liveTv.xmltvSource) {
    return { channelNames: new Map(), programsByChannel: new Map() };
  }

  try {
    return parseXmltvGuide(await readTextSource(liveTv.xmltvSource));
  } catch (error) {
    messages.push(`XMLTV guide: ${error.message}`);
    return { channelNames: new Map(), programsByChannel: new Map() };
  }
}

function getVideoLibraryItems(library = {}) {
  const sections = library.sections || {};
  return [...(sections.movies || []), ...(sections.tv || [])].filter((item) => item.path);
}

function getCustomChannelDefinitions(settings) {
  const liveTv = settings.liveTv || {};
  const rawDefinitions = splitLines(liveTv.customChannels);

  return rawDefinitions
    .map((definition) => {
      const [name, sectionText = "movies,tv", query = "", slotText = "30"] = definition
        .split("|")
        .map((part) => part.trim());
      const sections = new Set(
        sectionText
          .split(/[+/; ]+/)
          .join(",")
          .split(",")
          .map((part) => part.trim().toLowerCase())
          .filter(Boolean),
      );
      const slotMinutes = Number(slotText) || DEFAULT_SLOT_MINUTES;

      if (!name) {
        return null;
      }

      return {
        name,
        query: query.toLowerCase(),
        sections: sections.size ? sections : new Set(["movies", "tv"]),
        slotMinutes: Math.max(5, Math.min(240, slotMinutes)),
      };
    })
    .filter(Boolean);
}

function getLibraryItemSearchText(item) {
  return [
    item.title,
    item.seriesTitle,
    item.meta,
    item.artist,
    item.album,
    item.metadata?.overview,
    item.metadata?.provider,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getCustomChannelItems(definition, library) {
  const allItems = getVideoLibraryItems(library);

  return allItems
    .filter((item) => definition.sections.has(item.section) || (item.section === "tv" && definition.sections.has("shows")))
    .filter((item) => !definition.query || getLibraryItemSearchText(item).includes(definition.query))
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
}

function getScheduledItem(items, slotMinutes, offset = 0, now = new Date()) {
  if (!items.length) {
    return null;
  }

  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const slotIndex = Math.floor(minutesSinceMidnight / slotMinutes) + offset;
  return items[((slotIndex % items.length) + items.length) % items.length];
}

function createLocalLiveCard(definition, item, offset = 0, now = new Date()) {
  if (!item) {
    return null;
  }

  const start = new Date(now);
  const slotMinutes = definition.slotMinutes || DEFAULT_SLOT_MINUTES;
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const slotStartMinute = (Math.floor(minutesSinceMidnight / slotMinutes) + offset) * slotMinutes;
  start.setHours(0, slotStartMinute, 0, 0);
  const stop = new Date(start.getTime() + slotMinutes * 60000);
  const programTitle = item.seriesTitle ? `${item.seriesTitle} - ${item.title}` : item.title;

  return createLiveCard(
    {
      brand: "live-tv",
      coverUrl: item.coverUrl,
      name: definition.name,
      sourceType: "Custom",
    },
    {
      start,
      stop,
      title: programTitle,
    },
    {
      localItem: {
        id: getPublicId(item),
        path: item.path,
        title: item.title,
      },
      meta: `${definition.name} | ${formatTimeRange({ start, stop })}`,
      status: offset === 0 ? "Live" : "Next",
    },
  );
}

function loadCustomChannels(settings, library, messages) {
  const liveTv = settings.liveTv || {};

  if (!liveTv.customChannelsEnabled) {
    return [];
  }

  const definitions = getCustomChannelDefinitions(settings);

  if (!definitions.length) {
    messages.push("Custom channels need at least one definition, like: The Office | tv | The Office | 30");
    return [];
  }

  return definitions
    .map((definition) => {
      const items = getCustomChannelItems(definition, library);

      if (!items.length) {
        messages.push(`${definition.name}: no matching local video files were found.`);
        return null;
      }

      const now = createLocalLiveCard(definition, getScheduledItem(items, definition.slotMinutes), 0);
      const next = createLocalLiveCard(definition, getScheduledItem(items, definition.slotMinutes, 1), 1);

      return {
        name: definition.name,
        now,
        next,
        sourceType: "Custom",
      };
    })
    .filter(Boolean);
}

function attachGuidePrograms(channels, guide, now = new Date()) {
  return channels.map((channel) => {
    const programKeys = [channel.id, channel.name, channel.channelName].filter(Boolean);
    const programs = programKeys.map((key) => guide.programsByChannel.get(key)).find(Boolean) || [];
    const { current, next } = getCurrentAndNextProgram(programs, now);

    return {
      ...channel,
      currentProgram: current,
      nextProgram: next,
    };
  });
}

function createSourceCards(settings) {
  const liveTv = settings.liveTv || {};

  return [
    {
      brand: "youtube-tv",
      meta: "Opens the signed-in YouTube TV guide in Browser",
      status: liveTv.youtubeTvEnabled === false ? "Off" : "Open",
      target: liveTv.youtubeTvEnabled === false ? "" : normalizeUrl(liveTv.youtubeTvUrl, DEFAULT_YOUTUBE_TV_URL),
      title: "YouTube TV",
    },
    {
      brand: "live-tv",
      meta: liveTv.hdHomeRunUrl || "Add your tuner IP or hostname in Settings",
      status: liveTv.hdHomeRunEnabled ? "On" : "Setup",
      title: "HDHomeRun",
    },
    {
      brand: "live-tv",
      meta: liveTv.m3uSource || "Add an M3U playlist URL or file path",
      status: liveTv.m3uEnabled ? "On" : "Setup",
      title: "M3U Playlist",
    },
    {
      brand: "live-tv",
      meta: liveTv.xmltvSource || "Add XMLTV guide data for now/next schedules",
      status: liveTv.xmltvEnabled ? "On" : "Setup",
      title: "XMLTV Guide",
    },
  ];
}

async function loadLiveTvData(settings = {}, library = {}) {
  const liveTv = {
    customChannels: "",
    customChannelsEnabled: false,
    enabled: false,
    hdHomeRunEnabled: false,
    hdHomeRunUrl: "",
    m3uEnabled: false,
    m3uSource: "",
    xmltvEnabled: false,
    xmltvSource: "",
    youtubeTvEnabled: true,
    youtubeTvUrl: DEFAULT_YOUTUBE_TV_URL,
    ...(settings.liveTv || {}),
  };
  const nextSettings = { ...settings, liveTv };
  const messages = [];
  const shelves = [];
  const homeItems = [];
  const sourceCards = createSourceCards(nextSettings);

  if (!liveTv.enabled) {
    shelves.push({
      items: sourceCards,
      source: "live-tv",
      title: "Live TV Sources",
    });
    messages.push("Live TV is off. Enable it in Settings to load tuners, playlists, XMLTV, and custom channels.");
    return { homeItems, messages, shelves, updatedAt: new Date().toISOString() };
  }

  const [hdHomeRunChannels, m3uChannels, xmltvGuide] = await Promise.all([
    loadHdHomeRunChannels(nextSettings, messages),
    loadM3uChannels(nextSettings, messages),
    loadXmltvGuide(nextSettings, messages),
  ]);
  const externalChannels = attachGuidePrograms([...hdHomeRunChannels, ...m3uChannels], xmltvGuide);
  const externalLiveItems = externalChannels.map((channel) => createLiveCard(channel, channel.currentProgram));
  const customChannels = loadCustomChannels(nextSettings, library, messages);
  const customLiveItems = customChannels.map((channel) => channel.now).filter(Boolean);
  const customNextItems = customChannels.map((channel) => channel.next).filter(Boolean);
  const liveItems = [...customLiveItems, ...externalLiveItems].filter(Boolean);

  if (liveItems.length) {
    shelves.push({ items: liveItems.slice(0, 40), source: "live-tv", title: "Live Now" });
    homeItems.push(...liveItems.slice(0, 8));
  }

  const guideItems = externalChannels
    .filter((channel) => channel.currentProgram || channel.nextProgram)
    .flatMap((channel) => [
      channel.currentProgram ? createLiveCard(channel, channel.currentProgram) : null,
      channel.nextProgram ? createLiveCard(channel, channel.nextProgram, { status: "Next" }) : null,
    ])
    .filter(Boolean);

  if (guideItems.length || customNextItems.length) {
    shelves.push({
      items: [...guideItems, ...customNextItems].slice(0, 48),
      source: "live-tv",
      title: "Channel Guide",
    });
  }

  if (customLiveItems.length) {
    shelves.push({ items: customLiveItems, source: "live-tv", title: "Custom Channels" });
  }

  shelves.push({
    items: sourceCards,
    source: "live-tv",
    title: "Live TV Sources",
  });

  if (!liveItems.length && !messages.length) {
    messages.push("No live channels were found. Add HDHomeRun, M3U, or custom channels in Settings.");
  }

  return {
    homeItems,
    messages,
    shelves,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  DEFAULT_YOUTUBE_TV_URL,
  loadLiveTvData,
};
