# ToneOS Android Launcher

This is the native Android shell for ToneOS. It mirrors the desktop ToneOS layout with the wallpaper, bottom taskbar, app drawer, Android apps, PC remote controls, and a MediaCenter client for watching media served by the home theater PC.

## Build

1. Install Android Studio.
2. Open this `android/` folder as the project.
3. Let Android Studio install the Android SDK, Gradle, and project dependencies.
4. Connect an Android device with USB debugging enabled.
5. Run the `app` configuration.

To create an APK in Android Studio, use `Build > Generate Signed Bundle / APK`.

## Launcher Mode

The app declares Android Home support. After installing it, open Android settings and choose ToneOS Launcher as the default Home app.

## PC Remote

The `PC Remote` screen controls ToneOS on the PC through the ToneOS Media Server.

1. On the PC, open ToneOS.
2. Turn on `Settings > Media Server`.
3. Set a PIN/password.
4. Use the LAN URL shown by ToneOS, such as `http://192.168.1.50:8096`.
5. Enter that URL and PIN in the Android launcher.

Remote control stays protected by the Media Server same-network and PIN settings.

## MediaCenter Client

Open `Settings` in the launcher and enter the ToneOS Media Server URL shown on the PC, such as `http://192.168.1.50:8096`. Opening `MediaCenter` loads the server client inside the launcher so movies and TV shows can direct-play from the home theater PC when the device supports the file format.

The same client also shows scanned games and emulator ROMs. Pressing `Play on host` starts the game on the ToneOS PC so emulator saves and save states stay on the host. Use Moonlight on Android with Sunshine on the ToneOS PC for the actual low-latency game stream and controller input.

## Updating Without USB

Android will not let a sideloaded app silently update itself like a desktop app unless it is installed through a managed store, device-owner setup, or system image. The practical no-cable options are:

1. Transfer the new `app-debug.apk` to the device and tap it to update.
2. Use Android 11+ `Wireless debugging` and install with `adb install -r` over Wi-Fi.
3. Later, add a ToneOS updater screen that downloads a release APK and opens Android's installer prompt.

For wireless ADB:

```bash
adb pair DEVICE_IP:PAIRING_PORT
adb connect DEVICE_IP:DEBUG_PORT
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
