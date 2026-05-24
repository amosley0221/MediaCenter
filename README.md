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

The Media Server also exposes a PIN-protected `/api/remote` endpoint for trusted same-network clients such as the ToneOS Android Launcher. Remote commands can open Home, MediaCenter sections, Browser, Settings, Task Manager, or close the active ToneOS window.

## Host Emulator Streaming

ToneOS uses a host-streaming model for emulator play across devices. The ROM library, emulator app, save files, and save states stay on the ToneOS PC. Remote devices open the Media Server client, choose `Games`, and press `Play on host`; ToneOS launches that game on the PC.

For low-latency video and controller input, pair this with Sunshine on the ToneOS PC and Moonlight on the remote device. ToneOS handles the host library and launch command; Sunshine/Moonlight handles the game stream.

Setup flow:

1. Install and configure your emulator on the ToneOS PC.
2. Associate ROM file types with that emulator, or open ROMs once from Windows/macOS and choose the emulator as the default app.
3. In ToneOS, use `MediaCenter > Add Media > Emulator ROMs` and select the ROM folder.
4. Enable `Settings > Game Streaming > Enable host game streaming`.
5. Enable `Settings > Media Server`, set a PIN, and use the client URL on phones, tablets, laptops, or another PC.
6. Install Moonlight on the remote device and pair it with Sunshine on the ToneOS PC.

When a remote device starts a ROM, saves remain on the host because the emulator is running on the ToneOS PC.

## Android Launcher

The `android/` folder contains the first native ToneOS Android Launcher scaffold. Open that folder in Android Studio to build and install it on an Android phone, tablet, or Android TV device.

Current Android launcher features:

- Can be selected as the Android Home app.
- Shows installed Android apps and launches them.
- Includes a PC Remote screen for sending commands to ToneOS on the PC.
- Stores the ToneOS server URL and optional PIN locally on the Android device.
- Uses the existing ToneOS Media Server URL, such as `http://192.168.1.50:8096`.

To control the PC from Android:

1. In ToneOS on the PC, enable `Settings > Media Server`.
2. Keep `Only allow same-network devices` on unless you intentionally expose the server another way.
3. Set a PIN/password.
4. Copy the LAN URL shown in the Media Server status panel.
5. Enter that URL and PIN in the Android launcher `PC Remote` screen.

## Desktop Features Wired

- Electron `webview` browser surface for live sites that block iframe embedding.
- Native file/folder picker for local media and books.
- Native folder picker for watch folders, game folders, and network shares.
- Steam library scan through `libraryfolders.vdf` and `appmanifest_*.acf`.
- Local scanner imports real movie, TV episode, music, book, and local game files into persistent MediaCenter shelves.
- Scanned Steam games persist in the Games section with Steam cover URLs and `steam://rungameid` launch links.
- Emulator ROM folders persist in the Games section and can be launched from the host through the Media Server client.
- Host emulator streaming keeps ROMs and saves on the ToneOS PC while remote devices use Sunshine/Moonlight for low-latency play.
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
- Optional streaming providers can populate the Streaming section with real live/recent data:
  - YouTube Data API can load live/latest videos from saved channel IDs, handles, search topics, or OAuth subscription data.
  - Twitch Helix API can load live followed streams and saved channels with a Client ID and access token.
  - Signed-in YouTube/Twitch browser sessions are still used for playback, chat, comments, quality controls, and fullscreen.

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
