# MediaCenter

MediaCenter is an Electron desktop prototype for a home theater media and gaming PC.

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
