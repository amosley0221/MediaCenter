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

- Native file/folder picker for local media and books.
- Native folder picker for watch folders, game folders, and network shares.
- Steam library scan through `libraryfolders.vdf` and `appmanifest_*.acf`.
- Scanned Steam games appear in the Games section as a `Steam Library` shelf.
- Source choices persist in local storage for this prototype.

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
