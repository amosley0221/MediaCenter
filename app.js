const clock = document.querySelector("#clock");
const desktop = document.querySelector(".desktop");
const launcher = document.querySelector("#launcher");
const drawerButton = document.querySelector("#drawerButton");
const restoreButton = document.querySelector("#restoreButton");
const homeButton = document.querySelector("#homeButton");
const taskSwitcher = document.querySelector("#taskSwitcher");
const taskList = document.querySelector("#taskList");
const taskEmpty = document.querySelector("#taskEmpty");
const focusReadout = document.querySelector("#focusReadout");
const launchTiles = [...document.querySelectorAll(".launch-tile")];
const settingsButton = document.querySelector("#settingsButton");
const launcherItems = [...launchTiles, settingsButton].filter(Boolean);
const navButtons = [...document.querySelectorAll(".dock-button")];
const appWindow = document.querySelector("#appWindow");
const appViews = {
  browser: document.querySelector("#browserApp"),
  media: document.querySelector(".media-center"),
  settings: document.querySelector("#settingsApp"),
};
const mediaSearch = document.querySelector("#mediaSearch");
const mediaSearchInput = document.querySelector("#mediaSearchInput");
const addMediaButton = document.querySelector("#addMediaButton");
const sourceManager = document.querySelector("#sourceManager");
const closeSourceManager = document.querySelector("#closeSourceManager");
const sourceActionButtons = [...document.querySelectorAll(".source-action")];
const sourceList = document.querySelector("#sourceList");
const sourceSummary = document.querySelector("#sourceSummary");
const mediaHero = document.querySelector(".media-hero");
const mediaSections = document.querySelector("#mediaSections");
const mediaTabs = [...document.querySelectorAll(".media-tab")];
const browserSearch = document.querySelector("#browserSearch");
const browserAddress = document.querySelector("#browserAddress");
const browserFrame = document.querySelector("#browserFrame");
const browserWebview = document.querySelector("#browserWebview");
const browserExternalLink = document.querySelector("#browserExternalLink");
const browserFallback = document.querySelector("#browserFallback");
const browserOpenLive = document.querySelector("#browserOpenLive");
const windowControls = [...document.querySelectorAll(".window-control")];
const windowDragbar = document.querySelector("#windowDragbar");
const resizeHandles = [...document.querySelectorAll(".resize-handle")];
const desktopBridge = window.mediaCenterDesktop || null;

const MIN_WINDOW_WIDTH = 520;
const MIN_WINDOW_HEIGHT = 360;
const WINDOW_MARGIN = 8;
const BROWSER_HOME = "https://example.com";
const MEDIA_SOURCE_STORAGE_KEY = "mediacenter.sources.v1";
const BLOCKED_EMBED_HOSTS = [
  "amazon.com",
  "disneyplus.com",
  "facebook.com",
  "hbomax.com",
  "hulu.com",
  "instagram.com",
  "max.com",
  "netflix.com",
  "plex.tv",
  "primevideo.com",
  "reddit.com",
  "spotify.com",
  "threads.net",
  "twitch.com",
  "twitch.tv",
  "twitter.com",
  "x.com",
  "youtu.be",
  "youtube.com",
];

const mediaCatalog = {
  movies: {
    section: "movies",
    title: "Movies",
    searchPlaceholder: "Search movies",
    hero: {
      label: "Continue Watching",
      title: "Dune: Part Two",
      text: "Resume in 4K HDR with surround audio and your watch progress intact.",
      action: "Play",
    },
    shelves: [
      {
        title: "Continue Watching",
        items: [
          { title: "Dune: Part Two", meta: "4K HDR | 42 min left", progress: 76 },
          { title: "The Batman", meta: "4K HDR | 1 hr left", progress: 35 },
          { title: "Top Gun: Maverick", meta: "Atmos | 28 min left", progress: 68 },
          { title: "No Time to Die", meta: "HDR | 51 min left", progress: 44 },
        ],
      },
      {
        title: "New Movies",
        items: [
          { title: "Furiosa", meta: "4K HDR | Added today" },
          { title: "Civil War", meta: "Dolby Vision | New" },
          { title: "Inside Out 2", meta: "Family | New" },
          { title: "The Fall Guy", meta: "Action | New" },
          { title: "Godzilla x Kong", meta: "4K HDR | New" },
        ],
      },
      {
        title: "Recently Added",
        items: [
          { title: "Oppenheimer", meta: "IMAX | Added yesterday" },
          { title: "Blade Runner 2049", meta: "Sci-fi | Added Mon" },
          { title: "Arrival", meta: "Sci-fi | Added Mon" },
          { title: "The Creator", meta: "HDR | Added Sun" },
          { title: "Interstellar", meta: "IMAX | Added Sat" },
        ],
      },
      {
        title: "Collections",
        items: [
          { title: "Spider-Man", meta: "9 movies" },
          { title: "Middle-earth", meta: "6 movies" },
          { title: "Star Wars", meta: "12 movies" },
          { title: "Christopher Nolan", meta: "11 movies" },
          { title: "MonsterVerse", meta: "5 movies" },
        ],
      },
    ],
  },
  tv: {
    section: "tv",
    title: "TV Shows",
    searchPlaceholder: "Search TV shows",
    hero: {
      label: "Next Episode",
      title: "Foundation",
      text: "Season 2, Episode 4 is ready. Series progress stays separate from the movie library.",
      action: "Play",
    },
    shelves: [
      {
        title: "Continue Watching",
        items: [
          { title: "Foundation", meta: "S2 E04 | Next up", progress: 48 },
          { title: "The Bear", meta: "S3 E02 | In progress", progress: 42 },
          { title: "Severance", meta: "S2 E01 | Next up", progress: 18 },
          { title: "The Last of Us", meta: "S1 E07 | Resume", progress: 72 },
        ],
      },
      {
        title: "Series",
        items: [
          {
            title: "Foundation",
            meta: "2 seasons | 20 episodes",
            seasons: [
              {
                title: "Season 1",
                episodes: [
                  { title: "The Emperor's Peace", meta: "E01 | 69 min", progress: 100 },
                  { title: "Preparing to Live", meta: "E02 | 61 min", progress: 100 },
                  { title: "The Mathematician's Ghost", meta: "E03 | 58 min", progress: 100 },
                ],
              },
              {
                title: "Season 2",
                episodes: [
                  { title: "In Seldon's Shadow", meta: "E01 | 49 min", progress: 100 },
                  { title: "A Glimpse of Darkness", meta: "E02 | 52 min", progress: 100 },
                  { title: "King and Commoner", meta: "E03 | 53 min", progress: 100 },
                  { title: "Where the Stars Are Scattered Thinly", meta: "E04 | 50 min", progress: 48 },
                ],
              },
            ],
          },
          {
            title: "The Bear",
            meta: "3 seasons | 28 episodes",
            seasons: [
              {
                title: "Season 1",
                episodes: [
                  { title: "System", meta: "E01 | 27 min", progress: 100 },
                  { title: "Hands", meta: "E02 | 31 min", progress: 100 },
                ],
              },
              {
                title: "Season 3",
                episodes: [
                  { title: "Tomorrow", meta: "E01 | 36 min", progress: 100 },
                  { title: "Next", meta: "E02 | 32 min", progress: 42 },
                ],
              },
            ],
          },
          {
            title: "Severance",
            meta: "2 seasons | 19 episodes",
            seasons: [
              {
                title: "Season 1",
                episodes: [
                  { title: "Good News About Hell", meta: "E01 | 57 min", progress: 100 },
                  { title: "Half Loop", meta: "E02 | 53 min", progress: 100 },
                ],
              },
              {
                title: "Season 2",
                episodes: [
                  { title: "Hello, Ms. Cobel", meta: "E01 | 51 min", progress: 18 },
                  { title: "Goodbye, Mrs. Selvig", meta: "E02 | 50 min", progress: 0 },
                ],
              },
            ],
          },
          { title: "Andor", meta: "2 seasons | 24 episodes" },
          { title: "The Last of Us", meta: "1 season | 9 episodes" },
        ],
      },
      {
        title: "New Episodes",
        items: [
          { title: "Andor", meta: "S2 E06 | Added today" },
          { title: "The Last of Us", meta: "S2 E02 | New" },
          { title: "House of the Dragon", meta: "S2 E08 | New" },
          { title: "Slow Horses", meta: "S4 E01 | New" },
          { title: "Fallout", meta: "S1 E05 | New" },
        ],
      },
      {
        title: "Networks",
        items: [
          { title: "Apple TV", meta: "18 series" },
          { title: "FX", meta: "12 series" },
          { title: "HBO", meta: "24 series" },
          { title: "Disney+", meta: "16 series" },
          { title: "Prime Video", meta: "10 series" },
        ],
      },
    ],
  },
  streaming: {
    section: "streaming",
    title: "Streaming",
    searchPlaceholder: "Search streaming services",
    hero: {
      label: "Streaming Hub",
      title: "Connected Services",
      text: "Mock account links for YouTube, Twitch, YouTube TV, Netflix, and the services that will launch through official apps or web portals.",
      action: "Open",
    },
    shelves: [
      {
        title: "Continue Across Services",
        items: [
          {
            title: "MKBHD: Studio Tour",
            meta: "YouTube | 12 min left",
            progress: 62,
            brand: "youtube",
            status: "Connected",
          },
          {
            title: "LIRIK Live",
            meta: "Twitch | Live channel",
            progress: 18,
            brand: "twitch",
            status: "Live",
          },
          {
            title: "Lakers vs Warriors",
            meta: "YouTube TV | Live TV",
            progress: 34,
            brand: "youtube-tv",
            status: "Live",
          },
          {
            title: "Stranger Things",
            meta: "Netflix | S4 E06",
            progress: 51,
            brand: "netflix",
            status: "Portal",
          },
        ],
      },
      {
        title: "Live Now",
        items: [
          { title: "Twitch Following", meta: "8 channels live", brand: "twitch", status: "Live" },
          { title: "YouTube Live", meta: "Subscriptions live", brand: "youtube", status: "Live" },
          { title: "YouTube TV Guide", meta: "Sports, news, DVR", brand: "youtube-tv", status: "Live" },
          { title: "Prime Video Sports", meta: "Thursday Night Football", brand: "prime", status: "Live" },
          { title: "Hulu Live", meta: "News and sports", brand: "hulu", status: "Live" },
        ],
      },
      {
        title: "Linked Services",
        items: [
          { title: "YouTube", meta: "Subscriptions, playlists, history", brand: "youtube", status: "Connected" },
          { title: "Twitch", meta: "Following, live channels, VODs", brand: "twitch", status: "Connected" },
          { title: "YouTube TV", meta: "Live TV, DVR, guide", brand: "youtube-tv", status: "Sign in" },
          { title: "Netflix", meta: "Portal launch, continue list", brand: "netflix", status: "Sign in" },
          { title: "Hulu", meta: "Portal launch", brand: "hulu", status: "Sign in" },
          { title: "Disney+", meta: "Portal launch", brand: "disney", status: "Sign in" },
          { title: "Prime Video", meta: "Portal launch", brand: "prime", status: "Sign in" },
        ],
      },
      {
        title: "Unified Watchlist",
        items: [
          { title: "The Studio", meta: "Apple TV | Watchlist", brand: "apple", status: "Saved" },
          { title: "Drive to Survive", meta: "Netflix | Watchlist", brand: "netflix", status: "Saved" },
          { title: "House Tour Playlist", meta: "YouTube | Playlist", brand: "youtube", status: "Saved" },
          { title: "Fallout", meta: "Prime Video | Watchlist", brand: "prime", status: "Saved" },
          { title: "The Bear", meta: "Hulu | Watchlist", brand: "hulu", status: "Saved" },
        ],
      },
    ],
  },
  music: {
    section: "music",
    title: "Music",
    searchPlaceholder: "Search music",
    hero: {
      label: "Now Playing",
      title: "Late Night Drive",
      text: "Albums, playlists, Plexamp, and receiver presets in one living-room music view.",
      action: "Resume",
    },
    shelves: [
      {
        title: "Continue Listening",
        items: [
          { title: "Random Access Memories", meta: "Daft Punk | Album", progress: 60 },
          { title: "House Favorites", meta: "Playlist | 82 songs", progress: 20 },
          { title: "Cinema Scores", meta: "Smart mix | 4 hr", progress: 35 },
          { title: "Late Night Drive", meta: "Smart mix | 2 hr", progress: 48 },
        ],
      },
      {
        title: "New Albums",
        items: [
          { title: "Hit Me Hard and Soft", meta: "Billie Eilish | Album" },
          { title: "Cowboy Carter", meta: "Beyonce | Album" },
          { title: "Chromakopia", meta: "Tyler, The Creator | Album" },
          { title: "GNX", meta: "Kendrick Lamar | Album" },
          { title: "Short n' Sweet", meta: "Sabrina Carpenter | Album" },
        ],
      },
      {
        title: "Recently Added",
        items: [
          { title: "Blonde", meta: "Frank Ocean | Album" },
          { title: "The College Dropout", meta: "Kanye West | Album" },
          { title: "Discovery", meta: "Daft Punk | Album" },
          { title: "Thriller", meta: "Michael Jackson | Album" },
          { title: "Songs in the Key of Life", meta: "Stevie Wonder | Album" },
        ],
      },
      {
        title: "Playlists",
        items: [
          { title: "Movie Night", meta: "43 songs" },
          { title: "Game Lobby", meta: "57 songs" },
          { title: "Sunday Reset", meta: "35 songs" },
          { title: "Workout", meta: "64 songs" },
          { title: "Dinner", meta: "29 songs" },
        ],
      },
    ],
  },
  books: {
    section: "books",
    title: "Books",
    searchPlaceholder: "Search books",
    hero: {
      label: "Continue Reading",
      title: "Project Hail Mary",
      text: "Books, comics, magazines, manuals, and PDFs share the same shelf language.",
      action: "Read",
    },
    shelves: [
      {
        title: "Continue Reading",
        items: [
          { title: "Project Hail Mary", meta: "Andy Weir | 63%", progress: 63 },
          { title: "Dune", meta: "Frank Herbert | 12%", progress: 12 },
          { title: "Watchmen", meta: "Graphic novel | 45%", progress: 45 },
          { title: "HTPC Manual", meta: "Personal PDF | 88%", progress: 88 },
        ],
      },
      {
        title: "New Books",
        items: [
          { title: "The Creative Act", meta: "Rick Rubin" },
          { title: "Tomorrow, and Tomorrow, and Tomorrow", meta: "Gabrielle Zevin" },
          { title: "The Will of the Many", meta: "James Islington" },
          { title: "Starter Villain", meta: "John Scalzi" },
          { title: "Fourth Wing", meta: "Rebecca Yarros" },
        ],
      },
      {
        title: "Recently Added",
        items: [
          { title: "The Martian", meta: "Andy Weir | EPUB" },
          { title: "Neuromancer", meta: "William Gibson | EPUB" },
          { title: "The Hobbit", meta: "J.R.R. Tolkien | EPUB" },
          { title: "Sapiens", meta: "Yuval Noah Harari | Audiobook" },
          { title: "Home Theater Notes", meta: "Personal PDF" },
        ],
      },
      {
        title: "Comics & Graphic Novels",
        items: [
          { title: "Saga", meta: "Volumes 1-10" },
          { title: "Batman: Year One", meta: "Graphic novel" },
          { title: "Maus", meta: "Complete edition" },
          { title: "The Sandman", meta: "Omnibus" },
          { title: "Akira", meta: "Box set" },
        ],
      },
    ],
  },
  games: {
    section: "games",
    title: "Games",
    searchPlaceholder: "Search games",
    hero: {
      label: "Continue Playing",
      title: "Forza Horizon 5",
      text: "Steam, Xbox, Epic, GOG, emulators, and remote play share a controller-friendly cover shelf.",
      action: "Play",
    },
    shelves: [
      {
        title: "Continue Playing",
        items: [
          { title: "Forza Horizon 5", meta: "Xbox | Installed", progress: 90 },
          { title: "Cyberpunk 2077", meta: "Steam | Installed", progress: 54 },
          { title: "Hades II", meta: "Steam | Cloud sync", progress: 28 },
          { title: "Halo Infinite", meta: "Xbox | Ready", progress: 8 },
        ],
      },
      {
        title: "Installed Games",
        items: [
          { title: "Starfield", meta: "Xbox | Installed" },
          { title: "Baldur's Gate 3", meta: "Steam | Installed" },
          { title: "Alan Wake 2", meta: "Epic | Installed" },
          { title: "Elden Ring", meta: "Steam | Installed" },
          { title: "Street Fighter 6", meta: "Steam | Installed" },
        ],
      },
      {
        title: "Recently Added",
        items: [
          { title: "Hades II", meta: "Steam | Added today" },
          { title: "Indiana Jones", meta: "Xbox | Added Mon" },
          { title: "Balatro", meta: "Steam | Added Sun" },
          { title: "Prince of Persia", meta: "Ubisoft | Added Sat" },
          { title: "Senua's Saga", meta: "Xbox | Added Fri" },
        ],
      },
      {
        title: "Cloud & Remote Play",
        items: [
          { title: "GeForce NOW", meta: "Cloud library" },
          { title: "Xbox Cloud", meta: "Game Pass" },
          { title: "PlayStation Remote", meta: "Living room console" },
          { title: "Moonlight", meta: "Gaming PC stream" },
          { title: "Retro Collection", meta: "214 games" },
        ],
      },
    ],
  },
};

const mediaHome = {
  section: "home",
  title: "Home",
  searchPlaceholder: "Search all media",
  hero: {
    label: "Continue Watching",
    title: "Dune: Part Two",
    text: "Jump back into your most recent movie, episode, album, book, or game.",
    action: "Play",
    posterSection: "movies",
  },
  shelves: [
    {
      title: "Continue",
      items: [
        { title: "Dune: Part Two", meta: "Movie | 42 min left", progress: 76, section: "movies" },
        { title: "Foundation", meta: "TV | S2 E04", progress: 48, section: "tv" },
        {
          title: "LIRIK Live",
          meta: "Twitch | Live channel",
          progress: 18,
          section: "streaming",
          brand: "twitch",
          status: "Live",
        },
        { title: "Forza Horizon 5", meta: "Game | Resume", progress: 90, section: "games" },
        { title: "Project Hail Mary", meta: "Book | 63%", progress: 63, section: "books" },
        { title: "Late Night Drive", meta: "Music | Smart mix", progress: 48, section: "music" },
      ],
    },
    {
      title: "Recently Added",
      items: [
        { title: "Furiosa", meta: "Movie | Added today", section: "movies" },
        { title: "Andor", meta: "TV | New episode", section: "tv" },
        { title: "MKBHD: Studio Tour", meta: "YouTube | New upload", section: "streaming", brand: "youtube" },
        { title: "Hades II", meta: "Game | Added today", section: "games" },
        { title: "The Creative Act", meta: "Book | New", section: "books" },
        { title: "Cowboy Carter", meta: "Music | New album", section: "music" },
      ],
    },
    {
      title: "Streaming Services",
      items: [
        { title: "YouTube", meta: "Connected | Playlists", section: "streaming", brand: "youtube", status: "Connected" },
        { title: "Twitch", meta: "Connected | Live channels", section: "streaming", brand: "twitch", status: "Connected" },
        { title: "YouTube TV", meta: "Live TV portal", section: "streaming", brand: "youtube-tv", status: "Sign in" },
        { title: "Netflix", meta: "Portal launcher", section: "streaming", brand: "netflix", status: "Sign in" },
        { title: "Hulu", meta: "Portal launcher", section: "streaming", brand: "hulu", status: "Sign in" },
        { title: "Prime Video", meta: "Portal launcher", section: "streaming", brand: "prime", status: "Sign in" },
      ],
    },
    {
      title: "Favorites",
      items: [
        { title: "Blade Runner 2049", meta: "Movie | Favorite", section: "movies" },
        { title: "The Bear", meta: "TV | Favorite", section: "tv" },
        { title: "Cyberpunk 2077", meta: "Game | Favorite", section: "games" },
        { title: "Dune", meta: "Book | Favorite", section: "books" },
        { title: "Random Access Memories", meta: "Music | Favorite", section: "music" },
      ],
    },
  ],
};

const mediaLibrary = Object.values(mediaCatalog);
const sourcePresets = {
  books: {
    detail: "EPUB, PDF, CBR, CBZ, magazines, manuals",
    iconClass: "poster-books",
    path: "D:\\Media\\Books",
    status: "Ready",
    title: "Books & Comics",
  },
  games: {
    detail: "Epic, GOG, emulators, shortcuts, portable games",
    iconClass: "poster-games",
    path: "D:\\Games",
    status: "Ready",
    title: "Game Folder",
  },
  local: {
    detail: "Movies, TV, music, photos, and mixed media",
    iconClass: "poster-movies",
    path: "D:\\Media",
    status: "Ready",
    title: "Local Media Files",
  },
  network: {
    detail: "NAS or shared folders from another PC",
    iconClass: "poster-streaming",
    path: "\\\\MediaServer\\Library",
    status: "Ready",
    title: "Network Share",
  },
  steam: {
    detail: "Steam libraryfolders.vdf scan and installed games import",
    iconClass: "poster-games",
    path: "C:\\Program Files (x86)\\Steam\\steamapps",
    status: "Scanned",
    title: "Steam Library",
  },
  watch: {
    detail: "Auto-rescan when new media files are added",
    iconClass: "poster-tv",
    path: "D:\\Incoming",
    status: "Watching",
    title: "Watch Folder",
  },
};

let activeLauncherIndex = 0;
let lastOpenedApp = null;
let activeWindowInteraction = null;
let browserFallbackTimer = null;
let activeTvSeriesTitle = "Foundation";
let activeTvSeasonIndex = 1;
let currentMediaSection = "home";
let openWindowRecords = [];
let activeWindowKey = null;
let taskSwitcherPinned = false;
let taskSwitcherCloseTimer = null;
let mediaSources = getInitialMediaSources();

function canUseDesktopBridge() {
  return Boolean(desktopBridge?.isElectron);
}

function getDemoMediaSources() {
  return [
    { ...sourcePresets.local, key: "local", status: "Ready" },
    { ...sourcePresets.steam, key: "steam", status: "Scanned" },
  ];
}

function loadSavedMediaSources() {
  try {
    const savedSources = JSON.parse(localStorage.getItem(MEDIA_SOURCE_STORAGE_KEY) || "null");

    if (!Array.isArray(savedSources)) {
      return null;
    }

    return savedSources.filter((source) => {
      return source && source.key && source.title && source.path && source.iconClass;
    });
  } catch {
    return null;
  }
}

function saveMediaSources() {
  try {
    localStorage.setItem(MEDIA_SOURCE_STORAGE_KEY, JSON.stringify(mediaSources));
  } catch {
    // Local storage can be unavailable in hardened browser contexts.
  }
}

function getInitialMediaSources() {
  return loadSavedMediaSources() || (canUseDesktopBridge() ? [] : getDemoMediaSources());
}

function updateClock() {
  const now = new Date();
  const formatted = now
    .toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" ", "")
    .toLowerCase();

  clock.textContent = formatted;
  clock.dateTime = now.toISOString();
}

function updateFocusReadout(title, description) {
  focusReadout.querySelector("strong").textContent = title;
  focusReadout.querySelector("span").textContent = description;
}

function setActiveLauncherItem(item) {
  launchTiles.forEach((tile) => tile.classList.toggle("active", tile === item));
  settingsButton?.classList.toggle("active", settingsButton === item);
  updateFocusReadout(item.dataset.title, item.dataset.description);
  activeLauncherIndex = Math.max(0, launcherItems.indexOf(item));
}

function setDrawerOpen(isOpen) {
  launcher.classList.toggle("is-open", isOpen);
  launcher.setAttribute("aria-hidden", String(!isOpen));
  drawerButton.setAttribute("aria-expanded", String(isOpen));
  drawerButton.classList.toggle("active", isOpen);

  if (isOpen) {
    launcherItems[activeLauncherIndex]?.focus();
  } else if (document.activeElement && launcher.contains(document.activeElement)) {
    drawerButton.focus();
  }
}

function showAppView(viewName) {
  Object.entries(appViews).forEach(([name, view]) => {
    view.hidden = name !== viewName;
  });
}

function getInitials(text) {
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
}

function getWindowKey(record) {
  if (record.type === "media") {
    return `media:${record.section || "home"}`;
  }

  return record.type;
}

function getWindowMeta(record) {
  if (record.type === "media") {
    const section = record.section || "home";
    const config = getMediaSection(section);
    const title = section === "home" ? "MediaCenter" : config.title;

    return {
      detail: section === "home" ? "Unified media hub" : "MediaCenter section",
      iconClass: `poster-${config.hero?.posterSection || config.section}`,
      title,
    };
  }

  if (record.type === "browser") {
    return {
      detail: record.target || "Web browser",
      iconClass: "poster-streaming",
      title: "Browser",
    };
  }

  return {
    detail: "Display, audio, controller, and system controls",
    iconClass: "poster-settings",
    title: "Settings",
  };
}

function createTaskPreview(record, meta) {
  const preview = document.createElement("span");
  const surface = document.createElement("span");

  preview.className = "task-preview";
  surface.className = `task-preview-surface ${meta.iconClass}`;

  if (record.type === "browser") {
    const address = document.createElement("span");
    const frame = document.createElement("span");
    const glow = document.createElement("span");

    preview.classList.add("task-preview-browser");
    address.className = "task-preview-address";
    address.textContent = record.target || BROWSER_HOME;
    frame.className = "task-preview-frame";
    glow.className = "task-preview-glow";
    frame.append(glow);
    preview.append(address, frame);

    return preview;
  }

  if (record.type === "settings") {
    preview.classList.add("task-preview-settings");

    ["Display", "Audio", "Controllers"].forEach((label) => {
      const chip = document.createElement("span");
      chip.textContent = label;
      surface.append(chip);
    });

    preview.append(surface);
    return preview;
  }

  const section = record.section || "home";
  const config = getMediaSection(section);
  const shelf = config.shelves[0];
  const label = document.createElement("span");
  const title = document.createElement("strong");
  const row = document.createElement("span");

  preview.classList.add("task-preview-media");
  label.textContent = config.hero.label;
  title.textContent = config.hero.title;
  row.className = "task-preview-row";

  shelf.items.slice(0, 4).forEach((item, index) => {
    const tile = document.createElement("span");
    tile.className = `task-preview-tile poster-${item.section || config.section}`;
    tile.style.setProperty("--cover-shift", `${index * 20}deg`);
    tile.textContent = getInitials(item.title);
    row.append(tile);
  });

  surface.append(label, title, row);
  preview.append(surface);
  return preview;
}

function updateTaskButtonState() {
  restoreButton.classList.toggle("has-minimized-app", openWindowRecords.length > 0);
}

function renderTaskSwitcher() {
  taskList.replaceChildren();
  taskEmpty.hidden = openWindowRecords.length > 0;

  openWindowRecords.forEach((record) => {
    const meta = getWindowMeta(record);
    const item = document.createElement("article");
    const openButton = document.createElement("button");
    const preview = createTaskPreview(record, meta);
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    const closeButton = document.createElement("button");

    item.className = "task-item";
    item.classList.toggle("active", record.key === activeWindowKey && !appWindow.hidden);
    openButton.className = "task-open";
    openButton.type = "button";
    openButton.setAttribute("aria-label", `Open ${meta.title}`);
    copy.className = "task-copy";
    title.textContent = meta.title;
    detail.textContent = meta.detail;
    closeButton.className = "task-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", `Close ${meta.title}`);
    closeButton.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10" /><path d="M17 7 7 17" /></svg>';

    copy.append(title, detail);
    openButton.append(preview, copy);
    item.append(openButton, closeButton);
    taskList.append(item);

    openButton.addEventListener("click", () => {
      openWindowRecord(record);
      setTaskSwitcherOpen(false);
    });

    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      closeWindowRecord(record.key);
    });
  });
}

function setTaskSwitcherOpen(isOpen, pinned = taskSwitcherPinned) {
  window.clearTimeout(taskSwitcherCloseTimer);
  taskSwitcherPinned = isOpen && pinned;
  taskSwitcher.hidden = !isOpen;
  taskSwitcher.classList.toggle("is-open", isOpen);
  taskSwitcher.setAttribute("aria-hidden", String(!isOpen));
  restoreButton.setAttribute("aria-expanded", String(isOpen));

  if (isOpen) {
    renderTaskSwitcher();
    setDrawerOpen(false);
  }
}

function scheduleTaskSwitcherClose() {
  if (taskSwitcherPinned) {
    return;
  }

  window.clearTimeout(taskSwitcherCloseTimer);
  taskSwitcherCloseTimer = window.setTimeout(() => {
    if (!taskSwitcher.matches(":hover") && !restoreButton.matches(":hover")) {
      setTaskSwitcherOpen(false, false);
    }
  }, 140);
}

function registerOpenWindow(record) {
  const key = getWindowKey(record);
  const nextRecord = { ...record, key };
  const existingIndex = openWindowRecords.findIndex((item) => item.key === key);

  if (existingIndex >= 0) {
    openWindowRecords.splice(existingIndex, 1);
  }

  openWindowRecords.unshift(nextRecord);
  activeWindowKey = key;
  updateTaskButtonState();

  if (!taskSwitcher.hidden) {
    renderTaskSwitcher();
  }
}

function openWindowRecord(record) {
  if (record.type === "browser") {
    openBrowser(record.target || BROWSER_HOME);
    return;
  }

  if (record.type === "settings") {
    openSettings();
    return;
  }

  openMediaCenter(record.section || "home");
}

function hideAppWindow() {
  appWindow.hidden = true;
  resetWindowGeometry();
  appWindow.classList.remove("controls-visible", "is-minimized", "is-fullscreen");
  setFullscreenShell(false);
  updateTaskButtonState();
}

function closeWindowRecord(key) {
  const closingActiveWindow = key === activeWindowKey;
  openWindowRecords = openWindowRecords.filter((record) => record.key !== key);

  if (closingActiveWindow) {
    activeWindowKey = null;
    lastOpenedApp = openWindowRecords[0] || null;
    hideAppWindow();
  }

  updateTaskButtonState();
  renderTaskSwitcher();
}

function closeActiveWindow() {
  if (activeWindowKey) {
    closeWindowRecord(activeWindowKey);
    return;
  }

  hideAppWindow();
}

function getMediaSection(section) {
  return section === "home" ? mediaHome : mediaCatalog[section] || mediaCatalog.movies;
}

function getSourceKey(sourceKey, sourcePath) {
  return sourcePath && sourceKey !== "steam" ? `${sourceKey}:${sourcePath}` : sourceKey;
}

function getSourceDetail(sourceKey, sourcePath) {
  const preset = sourcePresets[sourceKey];

  if (!sourcePath || !preset) {
    return preset?.detail || "Media source";
  }

  if (sourceKey === "watch") {
    return "Auto-rescan is ready for new files";
  }

  if (sourceKey === "games") {
    return "Game shortcuts and install folders from this location";
  }

  if (sourceKey === "network") {
    return "NAS or shared folder connected from this path";
  }

  if (sourceKey === "local") {
    return "Local file or folder added to the media library";
  }

  if (sourceKey === "books") {
    return "Reading file or folder added to the library";
  }

  return preset.detail;
}

function upsertMediaSource(source) {
  const existingIndex = mediaSources.findIndex((item) => item.key === source.key);

  if (existingIndex >= 0) {
    mediaSources.splice(existingIndex, 1, source);
  } else {
    mediaSources.unshift(source);
  }

  saveMediaSources();
  renderSourceList();
}

function setSourceActionBusy(sourceKey, isBusy) {
  const button = sourceActionButtons.find((item) => item.dataset.source === sourceKey);

  if (!button) {
    return;
  }

  button.disabled = isBusy;
  button.classList.toggle("is-busy", isBusy);
  button.setAttribute("aria-busy", String(isBusy));
}

function renderSourceList() {
  sourceList.replaceChildren();
  sourceSummary.textContent = `${mediaSources.length} ${mediaSources.length === 1 ? "source" : "sources"}`;

  if (mediaSources.length === 0) {
    const empty = document.createElement("p");
    empty.className = "source-empty";
    empty.textContent = "No media sources yet. Add a folder or scan Steam to build your library.";
    sourceList.append(empty);
    return;
  }

  mediaSources.forEach((source) => {
    const item = document.createElement("article");
    const icon = document.createElement("span");
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    const path = document.createElement("code");
    const status = document.createElement("em");

    item.className = "source-item";
    icon.className = `source-item-icon ${source.iconClass}`;
    icon.textContent = getInitials(source.title);
    copy.className = "source-item-copy";
    title.textContent = source.title;
    detail.textContent = source.detail;
    path.textContent = source.path;
    status.textContent = source.status;

    copy.append(title, detail, path);
    item.append(icon, copy, status);
    sourceList.append(item);
  });
}

function setSourceManagerOpen(isOpen) {
  sourceManager.hidden = !isOpen;
  sourceManager.classList.toggle("is-open", isOpen);

  if (isOpen) {
    renderSourceList();
    setDrawerOpen(false);
    setTaskSwitcherOpen(false);
    addMediaButton.classList.add("active");
    closeSourceManager.focus({ preventScroll: true });
  } else {
    addMediaButton.classList.remove("active");
  }
}

function applySteamGamesToLibrary(games) {
  const playableGames = games
    .filter((game) => game.name && !game.error)
    .slice(0, 16)
    .map((game) => ({
      title: game.name,
      meta: `Steam | ${game.appId}`,
    }));

  mediaCatalog.games.shelves = mediaCatalog.games.shelves.filter((shelf) => {
    return shelf.source !== "steam-scan";
  });

  if (!playableGames.length) {
    return;
  }

  mediaCatalog.games.shelves.splice(1, 0, {
    source: "steam-scan",
    title: "Steam Library",
    items: playableGames,
  });
}

async function addSteamLibrarySource() {
  const preset = sourcePresets.steam;

  if (!canUseDesktopBridge() || typeof desktopBridge.scanSteamLibrary !== "function") {
    upsertMediaSource({
      ...preset,
      key: "steam",
      status: "Rescanned",
    });
    renderMediaCenter("games");
    lastOpenedApp = { type: "media", section: "games" };
    registerOpenWindow(lastOpenedApp);
    return;
  }

  const result = await desktopBridge.scanSteamLibrary();
  const libraries = result.libraries || [];
  const games = result.games || [];
  const firstLibrary = libraries[0]?.steamAppsPath || libraries[0]?.path || "Default Steam locations";

  applySteamGamesToLibrary(games);
  upsertMediaSource({
    ...preset,
    key: "steam",
    detail: libraries.length
      ? `${games.length} installed ${games.length === 1 ? "game" : "games"} across ${libraries.length} Steam ${libraries.length === 1 ? "library" : "libraries"}`
      : `No Steam library found. Checked ${result.checkedPaths?.length || 0} default locations.`,
    path: firstLibrary,
    status: libraries.length ? "Scanned" : "Not found",
  });

  renderMediaCenter("games");
  lastOpenedApp = { type: "media", section: "games" };
  registerOpenWindow(lastOpenedApp);
}

async function addFolderSource(sourceKey) {
  const preset = sourcePresets[sourceKey];

  if (!preset) {
    return;
  }

  if (!canUseDesktopBridge() || typeof desktopBridge.pickSourceFolder !== "function") {
    upsertMediaSource({
      ...preset,
      key: sourceKey,
      status: preset.status,
    });
    return;
  }

  const result = await desktopBridge.pickSourceFolder(sourceKey);

  if (result.canceled) {
    return;
  }

  const sourcePaths = result.paths?.length ? result.paths : [result.path];

  sourcePaths.filter(Boolean).forEach((sourcePath) => {
    upsertMediaSource({
      ...preset,
      detail: getSourceDetail(sourceKey, sourcePath),
      key: getSourceKey(sourceKey, sourcePath),
      path: sourcePath,
      status: sourceKey === "watch" ? "Watching" : "Ready",
    });
  });

  if (sourceKey === "games") {
    renderMediaCenter("games");
    lastOpenedApp = { type: "media", section: "games" };
    registerOpenWindow(lastOpenedApp);
  }

  if (sourceKey === "books") {
    renderMediaCenter("books");
    lastOpenedApp = { type: "media", section: "books" };
    registerOpenWindow(lastOpenedApp);
  }
}

async function addMediaSource(sourceKey) {
  const preset = sourcePresets[sourceKey];

  if (!preset) {
    return;
  }

  setSourceActionBusy(sourceKey, true);

  try {
    if (sourceKey === "steam") {
      await addSteamLibrarySource();
    } else {
      await addFolderSource(sourceKey);
    }
  } catch (error) {
    upsertMediaSource({
      ...preset,
      detail: error.message || preset.detail,
      key: `${sourceKey}:error`,
      path: "Try again from the desktop app",
      status: "Needs attention",
    });
  } finally {
    setSourceActionBusy(sourceKey, false);
  }
}

function getItemSearchText(item) {
  const episodeText = item.seasons
    ? item.seasons
        .flatMap((season) => [season.title, ...season.episodes.map((episode) => episode.title)])
        .join(" ")
    : "";

  return `${item.title} ${item.meta || ""} ${episodeText}`.toLowerCase();
}

function getFilteredItems(items, query) {
  if (!query) {
    return items;
  }

  const normalizedQuery = query.toLowerCase();
  return items.filter((item) => getItemSearchText(item).includes(normalizedQuery));
}

function createMediaCard(item, section, index) {
  const article = document.createElement("button");
  const cover = document.createElement("div");
  const initials = document.createElement("span");
  const title = document.createElement("strong");
  const meta = document.createElement("span");
  const visualSection = item.section || section;

  article.className = "media-card";
  article.type = "button";
  article.classList.toggle("has-seasons", Boolean(item.seasons));
  article.classList.toggle("is-service-card", Boolean(item.brand));
  cover.className = `media-cover poster-${visualSection}`;
  if (item.brand) {
    cover.classList.add(`service-${item.brand}`);
  }
  cover.style.setProperty("--cover-shift", `${index * 18}deg`);
  initials.textContent = item.title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  title.textContent = item.title;
  meta.textContent = item.meta;

  cover.append(initials);
  article.append(cover, title, meta);

  if (item.seasons || item.status) {
    const badge = document.createElement("em");
    badge.textContent = item.status || `${item.seasons.length} seasons`;
    article.append(badge);
  }

  if (item.seasons) {
    article.addEventListener("click", () => {
      activeTvSeriesTitle = item.title;
      activeTvSeasonIndex = 0;
      renderMediaCenter("tv");
    });
  }

  if (item.progress) {
    const progress = document.createElement("i");
    progress.className = "media-progress";
    progress.style.setProperty("--progress", `${item.progress}%`);
    article.append(progress);
  }

  return article;
}

function createMediaShelf(shelf, sectionName, query) {
  const section = document.createElement("section");
  const header = document.createElement("header");
  const title = document.createElement("h2");
  const row = document.createElement("div");
  const filteredItems = getFilteredItems(shelf.items, query);

  if (filteredItems.length === 0) {
    return null;
  }

  section.className = "media-shelf";
  section.dataset.section = sectionName;
  title.textContent = shelf.title;
  row.className = "media-row";

  header.append(title);
  row.append(...filteredItems.map((item, index) => createMediaCard(item, sectionName, index)));
  section.append(header, row);

  return section;
}

function getSeriesItems(config) {
  return config.shelves.flatMap((shelf) => shelf.items).filter((item) => item.seasons);
}

function createSeasonPanel(config, query) {
  const seriesItems = getFilteredItems(getSeriesItems(config), query);

  if (seriesItems.length === 0) {
    return null;
  }

  const activeSeries =
    seriesItems.find((item) => item.title === activeTvSeriesTitle) || seriesItems[0];
  const activeSeason =
    activeSeries.seasons[activeTvSeasonIndex] || activeSeries.seasons[0];
  const panel = document.createElement("section");
  const summary = document.createElement("div");
  const poster = document.createElement("div");
  const posterInitials = document.createElement("span");
  const copy = document.createElement("div");
  const title = document.createElement("h2");
  const text = document.createElement("p");
  const seasonTabs = document.createElement("div");
  const episodeRow = document.createElement("div");

  activeTvSeriesTitle = activeSeries.title;
  activeTvSeasonIndex = Math.max(0, activeSeries.seasons.indexOf(activeSeason));
  panel.className = "season-panel";
  summary.className = "season-summary";
  poster.className = "season-poster poster-tv";
  posterInitials.textContent = activeSeries.title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  title.textContent = activeSeries.title;
  text.textContent = "Select a season, then pick an episode from that season.";
  seasonTabs.className = "season-tabs";
  episodeRow.className = "episode-row";

  activeSeries.seasons.forEach((season, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = season.title;
    button.classList.toggle("active", season === activeSeason);
    button.addEventListener("click", () => {
      activeTvSeasonIndex = index;
      renderMediaCenter("tv");
    });
    seasonTabs.append(button);
  });

  activeSeason.episodes.forEach((episode, index) => {
    const card = createMediaCard(episode, "tv", index);
    card.classList.add("episode-card");
    episodeRow.append(card);
  });

  poster.append(posterInitials);
  copy.append(title, text, seasonTabs);
  summary.append(poster, copy);
  panel.append(summary, episodeRow);

  return panel;
}

function createEmptyMediaState(query) {
  const empty = document.createElement("section");
  const title = document.createElement("h2");
  const text = document.createElement("p");

  empty.className = "media-empty";
  title.textContent = "No media found";
  text.textContent = query
    ? `Nothing matched "${query}".`
    : "There is nothing in this section yet.";
  empty.append(title, text);

  return empty;
}

function renderMediaCenter(focusSection = "home") {
  currentMediaSection = focusSection;
  const selected = getMediaSection(focusSection);
  const query = mediaSearchInput.value.trim();
  const shelves = selected.shelves
    .map((shelf) => createMediaShelf(shelf, selected.section, query))
    .filter(Boolean);
  const seasonPanel = selected.section === "tv" ? createSeasonPanel(selected, query) : null;

  mediaTabs.forEach((tab) => {
    const isActive = tab.dataset.section === focusSection;
    tab.classList.toggle("active", isActive);
  });

  mediaSearchInput.placeholder = selected.searchPlaceholder;
  mediaHero.querySelector(".hero-label").textContent = selected.hero.label;
  mediaHero.querySelector("h2").textContent = selected.hero.title;
  mediaHero.querySelector("p:last-of-type").textContent = selected.hero.text;
  mediaHero.querySelector(".hero-actions button:first-child").textContent = selected.hero.action || "Play";
  mediaHero.querySelector(".hero-poster").className =
    `hero-poster poster-${selected.hero.posterSection || selected.section}`;
  mediaHero.querySelector(".hero-poster span").textContent = selected.hero.title
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  mediaSections.replaceChildren(
    ...(seasonPanel ? [seasonPanel] : []),
    ...(shelves.length ? shelves : [createEmptyMediaState(query)]),
  );
}

function openFullscreenApp() {
  appWindow.hidden = false;
  resetWindowGeometry();
  appWindow.classList.remove("is-minimized");
  appWindow.classList.add("is-fullscreen");
  setFullscreenShell(true);
  updateTaskButtonState();
  setDrawerOpen(false);
}

function openMediaCenter(section = "home") {
  lastOpenedApp = { type: "media", section };
  registerOpenWindow(lastOpenedApp);
  showAppView("media");
  renderMediaCenter(section);
  openFullscreenApp();
}

function getBrowserUrl(value) {
  const entry = value.trim();

  if (!entry) {
    return BROWSER_HOME;
  }

  if (/^https?:\/\//i.test(entry)) {
    return entry;
  }

  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(entry)) {
    return `http://${entry}`;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(entry)) {
    return `https://${entry}`;
  }

  return `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(entry)}`;
}

function getBrowserHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isKnownBlockedEmbed(url) {
  const host = getBrowserHost(url);

  return BLOCKED_EMBED_HOSTS.some((blockedHost) => {
    return host === blockedHost || host.endsWith(`.${blockedHost}`);
  });
}

function setBrowserFallbackVisible(isVisible) {
  browserFallback.hidden = !isVisible;
}

function shouldUseElectronBrowser() {
  return canUseDesktopBridge() && Boolean(browserWebview);
}

function setActiveBrowserSurface(url, shouldFallback) {
  if (shouldUseElectronBrowser()) {
    browserFrame.hidden = true;
    browserWebview.hidden = false;
    setBrowserFallbackVisible(false);
    browserWebview.src = url;
    return;
  }

  browserFrame.hidden = false;
  browserWebview.hidden = true;
  browserFrame.dataset.fallbackMode = String(shouldFallback);
  setBrowserFallbackVisible(shouldFallback);
  browserFrame.src = shouldFallback ? "about:blank" : url;
}

function navigateBrowser(value) {
  const entry = value.trim() || BROWSER_HOME;
  const url = getBrowserUrl(entry);
  const shouldFallback = isKnownBlockedEmbed(url);

  window.clearTimeout(browserFallbackTimer);

  browserAddress.value = entry;
  browserExternalLink.href = url;
  lastOpenedApp = { type: "browser", target: entry };

  if (openWindowRecords.some((record) => record.key === "browser")) {
    registerOpenWindow(lastOpenedApp);
  }

  setActiveBrowserSurface(url, shouldFallback);
}

function openBrowser(target = browserAddress.value || BROWSER_HOME) {
  showAppView("browser");
  navigateBrowser(target);
  registerOpenWindow(lastOpenedApp);
  openFullscreenApp();
  browserAddress.focus({ preventScroll: true });
}

function openSettings() {
  lastOpenedApp = { type: "settings" };
  registerOpenWindow(lastOpenedApp);
  showAppView("settings");
  openFullscreenApp();
}

function openAppFromTile(tile) {
  setActiveLauncherItem(tile);

  if (tile.dataset.app === "browser") {
    openBrowser();
    return;
  }

  openMediaCenter(tile.dataset.section || "home");
}

function minimizeApp() {
  if (appWindow.hidden) {
    return;
  }

  appWindow.classList.add("is-minimized");
  setFullscreenShell(false);
  updateTaskButtonState();
}

function restoreApp() {
  const record =
    openWindowRecords.find((item) => item.key === activeWindowKey) ||
    openWindowRecords[0] ||
    lastOpenedApp;

  if (!record) {
    return;
  }

  if (appWindow.hidden) {
    openWindowRecord(record);
    return;
  }

  appWindow.classList.remove("is-minimized");
  setFullscreenShell(appWindow.classList.contains("is-fullscreen"));
  updateTaskButtonState();
}

function closeApp() {
  hideAppWindow();
}

function goHome() {
  setDrawerOpen(false);
  setTaskSwitcherOpen(false);
  closeApp();
  navButtons.forEach((item) => item.classList.toggle("active", item === homeButton));
}

function setFullscreenShell(isFullscreen) {
  desktop.classList.toggle("app-fullscreen", isFullscreen);

  if (!isFullscreen) {
    desktop.classList.remove("taskbar-peek");
  }
}

function updateTaskbarPeek(event) {
  if (!desktop.classList.contains("app-fullscreen")) {
    return;
  }

  const nearBottom = event.clientY >= window.innerHeight - 5;
  const leavingBottom = event.clientY < window.innerHeight - 86;

  if (nearBottom) {
    desktop.classList.add("taskbar-peek");
  } else if (leavingBottom) {
    desktop.classList.remove("taskbar-peek");
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resetWindowGeometry() {
  appWindow.classList.remove("is-dragging", "is-floating", "is-resizing");
  appWindow.style.left = "";
  appWindow.style.top = "";
  appWindow.style.width = "";
  appWindow.style.height = "";
}

function materializeWindowGeometry() {
  const rect = appWindow.getBoundingClientRect();

  appWindow.classList.remove("is-fullscreen");
  appWindow.classList.add("is-floating");
  setFullscreenShell(false);
  appWindow.style.left = `${Math.round(rect.left)}px`;
  appWindow.style.top = `${Math.round(rect.top)}px`;
  appWindow.style.width = `${Math.round(rect.width)}px`;
  appWindow.style.height = `${Math.round(rect.height)}px`;

  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

function applyWindowGeometry({ left, top, width, height }) {
  appWindow.style.left = `${Math.round(left)}px`;
  appWindow.style.top = `${Math.round(top)}px`;
  appWindow.style.width = `${Math.round(width)}px`;
  appWindow.style.height = `${Math.round(height)}px`;
}

function getDragGeometry(interaction, event) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = clamp(
    interaction.startRect.left + event.clientX - interaction.startX,
    WINDOW_MARGIN,
    Math.max(WINDOW_MARGIN, viewportWidth - interaction.startRect.width - WINDOW_MARGIN),
  );
  const top = clamp(
    interaction.startRect.top + event.clientY - interaction.startY,
    WINDOW_MARGIN,
    Math.max(WINDOW_MARGIN, viewportHeight - interaction.startRect.height - WINDOW_MARGIN),
  );

  return {
    height: interaction.startRect.height,
    left,
    top,
    width: interaction.startRect.width,
  };
}

function getResizeGeometry(interaction, event) {
  const direction = interaction.direction;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let left = interaction.startRect.left;
  let top = interaction.startRect.top;
  let width = interaction.startRect.width;
  let height = interaction.startRect.height;
  const dx = event.clientX - interaction.startX;
  const dy = event.clientY - interaction.startY;

  if (direction.includes("e")) {
    width = clamp(
      interaction.startRect.width + dx,
      MIN_WINDOW_WIDTH,
      viewportWidth - interaction.startRect.left - WINDOW_MARGIN,
    );
  }

  if (direction.includes("s")) {
    height = clamp(
      interaction.startRect.height + dy,
      MIN_WINDOW_HEIGHT,
      viewportHeight - interaction.startRect.top - WINDOW_MARGIN,
    );
  }

  if (direction.includes("w")) {
    left = clamp(
      interaction.startRect.left + dx,
      WINDOW_MARGIN,
      interaction.startRect.right - MIN_WINDOW_WIDTH,
    );
    width = interaction.startRect.right - left;
  }

  if (direction.includes("n")) {
    top = clamp(
      interaction.startRect.top + dy,
      WINDOW_MARGIN,
      interaction.startRect.bottom - MIN_WINDOW_HEIGHT,
    );
    height = interaction.startRect.bottom - top;
  }

  return { height, left, top, width };
}

function startWindowInteraction(event, type, direction = "") {
  if (event.button !== 0 || appWindow.hidden || appWindow.classList.contains("is-minimized")) {
    return;
  }

  event.preventDefault();

  activeWindowInteraction = {
    direction,
    startRect: materializeWindowGeometry(),
    startX: event.clientX,
    startY: event.clientY,
    type,
  };

  appWindow.classList.toggle("is-dragging", type === "drag");
  appWindow.classList.toggle("is-resizing", type === "resize");
}

function handleWindowPointerMove(event) {
  if (!activeWindowInteraction) {
    return;
  }

  const nextGeometry =
    activeWindowInteraction.type === "drag"
      ? getDragGeometry(activeWindowInteraction, event)
      : getResizeGeometry(activeWindowInteraction, event);

  applyWindowGeometry(nextGeometry);
}

function endWindowInteraction() {
  if (!activeWindowInteraction) {
    return;
  }

  activeWindowInteraction = null;
  appWindow.classList.remove("is-dragging", "is-resizing");
}

function updateWindowControlsVisibility(event) {
  if (appWindow.hidden || appWindow.classList.contains("is-minimized")) {
    return;
  }

  const bounds = appWindow.getBoundingClientRect();
  const inHotspot =
    event.clientX >= bounds.left &&
    event.clientX <= bounds.left + 172 &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.top + 72;

  appWindow.classList.toggle("controls-visible", inHotspot);
}

drawerButton.addEventListener("click", () => {
  setDrawerOpen(!launcher.classList.contains("is-open"));
});

restoreButton.addEventListener("pointerenter", () => {
  setTaskSwitcherOpen(true, false);
});

restoreButton.addEventListener("pointerleave", scheduleTaskSwitcherClose);

restoreButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const shouldOpen = taskSwitcher.hidden || !taskSwitcherPinned;
  setTaskSwitcherOpen(shouldOpen, shouldOpen);
});

taskSwitcher.addEventListener("pointerenter", () => {
  window.clearTimeout(taskSwitcherCloseTimer);
});

taskSwitcher.addEventListener("pointerleave", scheduleTaskSwitcherClose);

homeButton.addEventListener("click", goHome);

launchTiles.forEach((tile) => {
  tile.addEventListener("pointerenter", () => setActiveLauncherItem(tile));
  tile.addEventListener("focus", () => setActiveLauncherItem(tile));
  tile.addEventListener("click", () => openAppFromTile(tile));
});

settingsButton.addEventListener("pointerenter", () => setActiveLauncherItem(settingsButton));
settingsButton.addEventListener("focus", () => setActiveLauncherItem(settingsButton));
settingsButton.addEventListener("click", () => {
  setActiveLauncherItem(settingsButton);
  openSettings();
});

browserSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  navigateBrowser(browserAddress.value);
});

browserAddress.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  navigateBrowser(browserAddress.value);
});

mediaSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  renderMediaCenter(currentMediaSection);
});

mediaSearchInput.addEventListener("input", () => {
  renderMediaCenter(currentMediaSection);
});

addMediaButton.addEventListener("click", () => {
  setSourceManagerOpen(true);
});

closeSourceManager.addEventListener("click", () => {
  setSourceManagerOpen(false);
});

sourceManager.addEventListener("click", (event) => {
  if (event.target === sourceManager) {
    setSourceManagerOpen(false);
  }
});

sourceActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    addMediaSource(button.dataset.source);
  });
});

browserFrame.addEventListener("load", () => {
  window.clearTimeout(browserFallbackTimer);

  if (browserFrame.dataset.fallbackMode !== "true") {
    setBrowserFallbackVisible(false);
  }
});

browserWebview.addEventListener("did-navigate", (event) => {
  browserAddress.value = event.url;
  browserExternalLink.href = event.url;
});

browserWebview.addEventListener("did-navigate-in-page", (event) => {
  browserAddress.value = event.url;
  browserExternalLink.href = event.url;
});

browserWebview.addEventListener("page-title-updated", () => {
  if (openWindowRecords.some((record) => record.key === "browser")) {
    registerOpenWindow({ type: "browser", target: browserAddress.value });
  }
});

browserOpenLive.addEventListener("click", () => {
  window.open(browserExternalLink.href, "_blank", "noopener,noreferrer");
});

mediaTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    renderMediaCenter(tab.dataset.section);
    lastOpenedApp = { type: "media", section: tab.dataset.section };
    registerOpenWindow(lastOpenedApp);
  });
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    navButtons.forEach((item) => item.classList.toggle("active", item === button));
  });
});

windowControls.forEach((control) => {
  control.addEventListener("click", () => {
    const action = control.dataset.action;

    if (action === "minimize") {
      minimizeApp();
    }

    if (action === "fullscreen") {
      if (appWindow.classList.contains("is-fullscreen")) {
        resetWindowGeometry();
        appWindow.classList.remove("is-fullscreen");
        setFullscreenShell(false);
      } else {
        resetWindowGeometry();
        appWindow.classList.add("is-fullscreen");
        setFullscreenShell(true);
      }
    }

    if (action === "close") {
      closeActiveWindow();
    }
  });
});

windowDragbar.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".window-control")) {
    return;
  }

  startWindowInteraction(event, "drag");
});

resizeHandles.forEach((handle) => {
  handle.addEventListener("pointerdown", (event) => {
    startWindowInteraction(event, "resize", handle.dataset.resize);
  });
});

window.addEventListener("pointermove", handleWindowPointerMove);
window.addEventListener("pointermove", updateTaskbarPeek);
window.addEventListener("pointerup", endWindowInteraction);
window.addEventListener("pointercancel", endWindowInteraction);

appWindow.addEventListener("pointermove", updateWindowControlsVisibility);
appWindow.addEventListener("pointerleave", () => {
  appWindow.classList.remove("controls-visible");
});

document.addEventListener("click", (event) => {
  const clickedDrawer = drawerButton.contains(event.target);
  const clickedLauncher = launcher.contains(event.target);
  const clickedTaskButton = restoreButton.contains(event.target);
  const clickedTaskSwitcher = taskSwitcher.contains(event.target);

  if (!clickedDrawer && !clickedLauncher && launcher.classList.contains("is-open")) {
    setDrawerOpen(false);
  }

  if (!clickedTaskButton && !clickedTaskSwitcher && !taskSwitcher.hidden) {
    setTaskSwitcherOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!sourceManager.hidden) {
      setSourceManagerOpen(false);
      return;
    }

    if (!taskSwitcher.hidden) {
      setTaskSwitcherOpen(false);
      return;
    }

    if (launcher.classList.contains("is-open")) {
      setDrawerOpen(false);
      return;
    }

    if (!appWindow.hidden) {
      closeApp();
      return;
    }
  }

  if (!launcher.classList.contains("is-open")) {
    if (event.key === "Enter" && document.activeElement === drawerButton) {
      setDrawerOpen(true);
    }
    return;
  }

  if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
    return;
  }

  event.preventDefault();

  if (event.key === "Enter" || event.key === " ") {
    document.activeElement.click();
    return;
  }

  const currentIndex = Math.max(0, launcherItems.indexOf(document.activeElement));
  let nextIndex = currentIndex;

  if (event.key === "ArrowRight") {
    nextIndex = currentIndex + 1;
  }

  if (event.key === "ArrowLeft") {
    nextIndex = currentIndex - 1;
  }

  if (event.key === "ArrowDown") {
    nextIndex = currentIndex + 2;
  }

  if (event.key === "ArrowUp") {
    nextIndex = currentIndex - 2;
  }

  nextIndex = (nextIndex + launcherItems.length) % launcherItems.length;
  launcherItems[nextIndex].focus();
});

function applyStartupState() {
  const params = new URLSearchParams(window.location.search);
  const drawerParam = params.get("drawer");
  const appParam = params.get("app");
  const mediaQueryParam = params.get("search");

  if (mediaQueryParam) {
    mediaSearchInput.value = mediaQueryParam;
  }

  if (appParam) {
    const normalizedApp = appParam.toLowerCase();
    const browserTargetParam = params.get("url") || params.get("target");
    const matchingTile = launchTiles.find((tile) => {
      return (
        tile.dataset.title.toLowerCase() === normalizedApp ||
        tile.dataset.section === normalizedApp ||
        (normalizedApp === "movies" && tile.dataset.section === "movies") ||
        (normalizedApp === "tvshows" && tile.dataset.section === "tv") ||
        (normalizedApp === "tv shows" && tile.dataset.section === "tv")
      );
    });

    if (matchingTile) {
      if (matchingTile.dataset.app === "browser" && browserTargetParam) {
        setActiveLauncherItem(matchingTile);
        openBrowser(browserTargetParam);
      } else {
        openAppFromTile(matchingTile);
      }
    } else if (normalizedApp === "browser") {
      openBrowser(browserTargetParam || undefined);
    } else if (normalizedApp === "settings") {
      openSettings();
    } else if (normalizedApp === "mediacenter") {
      openMediaCenter("home");
    } else if (mediaLibrary.some((group) => group.section === normalizedApp)) {
      openMediaCenter(normalizedApp);
    }
  }

  if (params.get("controls") === "1") {
    appWindow.classList.add("controls-visible");
  }

  if (drawerParam === "1") {
    setDrawerOpen(true);
  }
}

updateClock();
setInterval(updateClock, 1000 * 15);
applyStartupState();
