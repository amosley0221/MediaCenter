const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const TWITCH_API_BASE = "https://api.twitch.tv/helix";
const REQUEST_TIMEOUT_MS = 12000;

function splitEntries(value = "") {
  return [
    ...new Set(
      String(value)
        .split(/[\n,]+/)
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
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function compactText(value, fallback = "") {
  const text = cleanText(value || fallback);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function formatDate(value) {
  if (!value) {
    return "recent";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recent";
  }

  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days === 0) {
    return "today";
  }
  if (days === 1) {
    return "yesterday";
  }
  if (days < 7) {
    return `${days} days ago`;
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatViewers(value) {
  const viewers = Number(value) || 0;
  if (viewers >= 1000000) {
    return `${(viewers / 1000000).toFixed(1)}M watching`;
  }
  if (viewers >= 1000) {
    return `${Math.round(viewers / 1000)}K watching`;
  }
  return `${viewers.toLocaleString()} watching`;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = {};

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text.slice(0, 160) };
      }
    }

    if (!response.ok) {
      const message = body.error?.message || body.message || response.statusText || "Request failed";
      throw new Error(`${response.status} ${message}`);
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function getThumbnail(thumbnails = {}) {
  return thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || "";
}

function makeSetupCard({ brand, title, meta, target }) {
  return {
    brand,
    meta,
    status: "Setup",
    target,
    title,
  };
}

function normalizeYoutubeChannelEntry(entry) {
  try {
    const url = new URL(entry);
    const channelMatch = url.pathname.match(/\/channel\/([^/]+)/i);
    const handleMatch = url.pathname.match(/\/@([^/]+)/i);

    if (channelMatch?.[1]) {
      return channelMatch[1];
    }
    if (handleMatch?.[1]) {
      return `@${handleMatch[1]}`;
    }
  } catch {
    // Not a URL, keep parsing as a plain ID or handle.
  }

  return entry.trim();
}

function isYoutubeChannelId(entry) {
  return /^UC[a-zA-Z0-9_-]{20,}$/.test(entry);
}

async function youtubeRequest(pathname, params, settings) {
  const url = new URL(`${YOUTUBE_API_BASE}${pathname}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  if (settings.youtubeApiKey) {
    url.searchParams.set("key", settings.youtubeApiKey);
  }

  const headers = {};
  if (settings.youtubeAccessToken) {
    headers.Authorization = `Bearer ${settings.youtubeAccessToken}`;
  }

  return fetchJson(url, { headers });
}

async function resolveYoutubeChannel(entry, settings, messages) {
  const normalizedEntry = normalizeYoutubeChannelEntry(entry);
  if (isYoutubeChannelId(normalizedEntry)) {
    return normalizedEntry;
  }

  const handle = normalizedEntry.replace(/^@/, "");
  if (handle) {
    try {
      const handleResult = await youtubeRequest(
        "/channels",
        { forHandle: handle, maxResults: 1, part: "snippet" },
        settings,
      );
      const channelId = handleResult.items?.[0]?.id;
      if (channelId) {
        return channelId;
      }
    } catch (error) {
      messages.push(`YouTube handle ${normalizedEntry}: ${error.message}`);
    }
  }

  try {
    const searchResult = await youtubeRequest(
      "/search",
      { maxResults: 1, part: "snippet", q: normalizedEntry, type: "channel" },
      settings,
    );
    return searchResult.items?.[0]?.id?.channelId || null;
  } catch (error) {
    messages.push(`YouTube channel ${normalizedEntry}: ${error.message}`);
    return null;
  }
}

async function getYoutubeSubscriptionChannels(settings, messages) {
  if (!settings.youtubeAccessToken) {
    return [];
  }

  try {
    const result = await youtubeRequest(
      "/subscriptions",
      { maxResults: 25, mine: true, part: "snippet" },
      settings,
    );
    return (result.items || [])
      .map((item) => item.snippet?.resourceId?.channelId)
      .filter(Boolean);
  } catch (error) {
    messages.push(`YouTube subscriptions: ${error.message}`);
    return [];
  }
}

function mapYoutubeVideo(item, status = "Video") {
  const videoId = item.id?.videoId;
  const snippet = item.snippet || {};

  if (!videoId) {
    return null;
  }

  return {
    brand: "youtube",
    coverUrl: getThumbnail(snippet.thumbnails),
    meta: `${cleanText(snippet.channelTitle || "YouTube")} | ${formatDate(snippet.publishedAt)}`,
    status,
    target: `https://www.youtube.com/watch?v=${videoId}`,
    title: compactText(snippet.title, "YouTube video"),
  };
}

async function getYoutubeVideosForChannel(channelId, settings, messages) {
  const results = { latest: [], live: [] };

  try {
    const liveResult = await youtubeRequest(
      "/search",
      { channelId, eventType: "live", maxResults: 5, part: "snippet", type: "video" },
      settings,
    );
    results.live = (liveResult.items || []).map((item) => mapYoutubeVideo(item, "Live")).filter(Boolean);
  } catch (error) {
    messages.push(`YouTube live ${channelId}: ${error.message}`);
  }

  try {
    const latestResult = await youtubeRequest(
      "/search",
      { channelId, maxResults: 5, order: "date", part: "snippet", type: "video" },
      settings,
    );
    results.latest = (latestResult.items || []).map((item) => mapYoutubeVideo(item, "New")).filter(Boolean);
  } catch (error) {
    messages.push(`YouTube videos ${channelId}: ${error.message}`);
  }

  return results;
}

async function getYoutubeSearches(settings, messages) {
  const searches = splitEntries(settings.youtubeSearches).slice(0, 6);
  const items = [];

  for (const query of searches) {
    try {
      const result = await youtubeRequest(
        "/search",
        { maxResults: 4, order: "date", part: "snippet", q: query, type: "video" },
        settings,
      );
      items.push(...(result.items || []).map((item) => mapYoutubeVideo(item, "Search")).filter(Boolean));
    } catch (error) {
      messages.push(`YouTube search ${query}: ${error.message}`);
    }
  }

  return items;
}

async function loadYoutubeData(settings = {}) {
  const messages = [];
  const shelves = [];
  const homeItems = [];

  if (!settings.youtubeEnabled) {
    return { homeItems, messages, shelves };
  }

  if (!settings.youtubeApiKey && !settings.youtubeAccessToken) {
    messages.push("YouTube needs an API key or OAuth token.");
    shelves.push({
      title: "YouTube Setup",
      items: [
        makeSetupCard({
          brand: "youtube",
          meta: "Add an API key or OAuth token in Settings",
          target: "https://developers.google.com/youtube/v3/getting-started",
          title: "Connect YouTube data",
        }),
      ],
      source: "streaming-provider",
    });
    return { homeItems, messages, shelves };
  }

  const configuredChannels = splitEntries(settings.youtubeChannels).slice(0, 12);
  const subscriptionChannels = await getYoutubeSubscriptionChannels(settings, messages);
  const resolvedChannels = [];

  for (const entry of configuredChannels) {
    const channelId = await resolveYoutubeChannel(entry, settings, messages);
    if (channelId) {
      resolvedChannels.push(channelId);
    }
  }

  const channelIds = [...new Set([...subscriptionChannels, ...resolvedChannels])].slice(0, 20);
  const liveItems = [];
  const latestItems = [];

  for (const channelId of channelIds) {
    const channelResults = await getYoutubeVideosForChannel(channelId, settings, messages);
    liveItems.push(...channelResults.live);
    latestItems.push(...channelResults.latest);
  }

  const searchItems = await getYoutubeSearches(settings, messages);

  if (liveItems.length) {
    shelves.push({ title: "YouTube Live", items: liveItems.slice(0, 18), source: "streaming-provider" });
    homeItems.push(...liveItems.slice(0, 6));
  }

  if (latestItems.length) {
    shelves.push({ title: "Latest From YouTube", items: latestItems.slice(0, 18), source: "streaming-provider" });
    homeItems.push(...latestItems.slice(0, 6));
  }

  if (searchItems.length) {
    shelves.push({ title: "YouTube Search Topics", items: searchItems.slice(0, 18), source: "streaming-provider" });
  }

  if (!shelves.length && !messages.length) {
    messages.push("YouTube returned no videos for the saved channels or searches.");
  }

  return { homeItems, messages, shelves };
}

async function twitchRequest(pathname, params, settings) {
  const url = new URL(`${TWITCH_API_BASE}${pathname}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => url.searchParams.append(key, entry));
      return;
    }
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${settings.twitchAccessToken}`,
      "Client-Id": settings.twitchClientId,
    },
  });
}

function mapTwitchStream(stream) {
  return {
    brand: "twitch",
    coverUrl: String(stream.thumbnail_url || "")
      .replace("{width}", "440")
      .replace("{height}", "248"),
    meta: `${stream.game_name || "Twitch"} | ${formatViewers(stream.viewer_count)}`,
    status: "Live",
    target: `https://www.twitch.tv/${stream.user_login}`,
    title: compactText(stream.title, stream.user_name || stream.user_login),
  };
}

async function getTwitchUserId(login, settings, messages) {
  if (!login) {
    return null;
  }

  try {
    const result = await twitchRequest("/users", { login }, settings);
    return result.data?.[0]?.id || null;
  } catch (error) {
    messages.push(`Twitch user ${login}: ${error.message}`);
    return null;
  }
}

async function loadTwitchData(settings = {}) {
  const messages = [];
  const shelves = [];
  const homeItems = [];

  if (!settings.twitchEnabled) {
    return { homeItems, messages, shelves };
  }

  if (!settings.twitchClientId || !settings.twitchAccessToken) {
    messages.push("Twitch needs a Client ID and access token.");
    shelves.push({
      title: "Twitch Setup",
      items: [
        makeSetupCard({
          brand: "twitch",
          meta: "Add Twitch API credentials in Settings",
          target: "https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/",
          title: "Connect Twitch data",
        }),
      ],
      source: "streaming-provider",
    });
    return { homeItems, messages, shelves };
  }

  const configuredChannels = splitEntries(settings.twitchChannels)
    .map((entry) => entry.replace(/^@/, "").toLowerCase())
    .slice(0, 100);
  const liveChannels = [];

  if (settings.twitchUserLogin) {
    const userId = await getTwitchUserId(settings.twitchUserLogin.trim().toLowerCase(), settings, messages);

    if (userId) {
      try {
        const result = await twitchRequest("/streams/followed", { first: 30, user_id: userId }, settings);
        liveChannels.push(...(result.data || []));
      } catch (error) {
        messages.push(`Twitch followed streams: ${error.message}`);
      }
    }
  }

  if (configuredChannels.length) {
    try {
      const result = await twitchRequest(
        "/streams",
        { first: 100, user_login: configuredChannels },
        settings,
      );
      liveChannels.push(...(result.data || []));
    } catch (error) {
      messages.push(`Twitch channels: ${error.message}`);
    }
  }

  const itemsByChannel = new Map();
  liveChannels.map(mapTwitchStream).forEach((item) => {
    const key = item.target.toLowerCase();
    if (!itemsByChannel.has(key)) {
      itemsByChannel.set(key, item);
    }
  });
  const liveItems = [...itemsByChannel.values()];

  if (liveItems.length) {
    shelves.push({ title: "Twitch Live", items: liveItems.slice(0, 30), source: "streaming-provider" });
    homeItems.push(...liveItems.slice(0, 8));
  }

  if (!shelves.length && !messages.length) {
    messages.push("Twitch returned no live streams for followed or saved channels.");
  }

  return { homeItems, messages, shelves };
}

async function loadStreamingData(settings = {}) {
  const providerSettings = {
    twitchAccessToken: "",
    twitchChannels: "",
    twitchClientId: "",
    twitchEnabled: false,
    twitchUserLogin: "",
    youtubeAccessToken: "",
    youtubeApiKey: "",
    youtubeChannels: "",
    youtubeEnabled: false,
    youtubeSearches: "",
    ...(settings || {}),
  };
  const [youtube, twitch] = await Promise.all([
    loadYoutubeData(providerSettings),
    loadTwitchData(providerSettings),
  ]);

  return {
    homeItems: [...twitch.homeItems, ...youtube.homeItems].slice(0, 18),
    messages: [...twitch.messages, ...youtube.messages],
    shelves: [...twitch.shelves, ...youtube.shelves],
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  loadStreamingData,
};
