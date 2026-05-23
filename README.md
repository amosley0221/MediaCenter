# ToneOS

ToneOS is an Electron desktop prototype for a home theater media and gaming PC. MediaCenter remains the built-in app for controlling movies, TV, music, books, games, and streaming.

## Run

Install dependencies once:

```sh
npm install
```

Start the desktop app:

```sh
npm start
```

For a windowed development launch instead of fullscreen:

```sh
MEDIA_CENTER_WINDOWED=1 npm start
```

## Media Server

Open `Settings > Media Server`, turn on `Enable ToneOS Media Server`, add movies and TV folders, then save settings. When the server is running, the status panel shows local client URLs such as `http://192.168.1.50:8096/` for phones, tablets, laptops, or another PC on the same network.

Same-network access is enabled by default. Add a PIN/password before sharing the client URL with other devices.

## Desktop Features Wired

- Electron `webview` browser surface for live sites that block iframe embedding.
- Native file/folder picker for local media and books.
- Native folder picker for watch folders, game folders, and network shares.
- Steam library scan through `libraryfolders.vdf` and `appmanifest_*.acf`.
- Local scanner imports real movie, TV episode, music, book, and local game files into persistent MediaCenter shelves.
- Scanned Steam games persist in the Games section with Steam cover URLs and `steam://rungameid` launch links.
- Source choices persist in local storage for this prototype.
- The desktop media library is saved in Electron app data as `media-library.json`.
- Settings are real persisted controls in Electron app data as `settings.json`.
- Display settings can optionally open MediaCenter automatically after ToneOS starts.
- ToneOS theme settings control the OS color system and wallpaper variants.
- Wallpaper options include the default gradient, default gradient with ToneOS branding, black/gold, and black/gold with ToneOS branding.
- Media Server settings are off by default and can serve movies and TV shows to same-network devices from a built-in Electron HTTP server.
- Media Server supports movies/TV folder scans, LAN-only access, optional PIN/password protection, UDP discovery beacons, and direct-play streaming for compatible video files.
- FFmpeg transcoding is represented as a planned capability; the current server direct-plays files the client device can already decode.
- Optional metadata providers can enrich scanned libraries:
  - TMDb for movie and TV poster/backdrop metadata with a TMDb API key.
  - RAWG for game artwork/details with a RAWG API key.
  - Open Library for book cover/author metadata.
  - MusicBrainz for music recording metadata.
  - Steam artwork from public Steam CDN URLs.

## Packaging

Windows installer and portable builds:

```sh
npm run pack:win
```

For private unsigned Windows builds, code signing is disabled in `package.json` to avoid requiring Windows symlink privileges while Electron Builder prepares signing helper files.

macOS DMG build:

```sh
npm run pack:mac
```
