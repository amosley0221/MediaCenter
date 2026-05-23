# ToneOS Android Launcher

This is the first native Android client for ToneOS. It is separate from the Electron desktop app and is meant for Android phones, tablets, and Android TV devices.

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
