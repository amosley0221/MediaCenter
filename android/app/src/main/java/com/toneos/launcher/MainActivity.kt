package com.toneos.launcher

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class LauncherApp(
    val label: String,
    val packageName: String,
)

data class ToneApp(
    val title: String,
    val subtitle: String,
    val initials: String,
    val screen: ToneScreen,
    val colors: List<Color>,
)

enum class ToneScreen {
    MediaCenter,
    Apps,
    Remote,
    Settings,
}

private val toneApps = listOf(
    ToneApp(
        title = "MediaCenter",
        subtitle = "Home theater library",
        initials = "MC",
        screen = ToneScreen.MediaCenter,
        colors = listOf(Color(0xFF7ED957), Color(0xFF55C8FF), Color(0xFF6957FF)),
    ),
    ToneApp(
        title = "Apps",
        subtitle = "Android apps",
        initials = "AP",
        screen = ToneScreen.Apps,
        colors = listOf(Color(0xFFFFA63D), Color(0xFFFF5E7B), Color(0xFF6957FF)),
    ),
    ToneApp(
        title = "PC Remote",
        subtitle = "Control ToneOS",
        initials = "PC",
        screen = ToneScreen.Remote,
        colors = listOf(Color(0xFF55C8FF), Color(0xFF6957FF), Color(0xFF10122B)),
    ),
    ToneApp(
        title = "Settings",
        subtitle = "Launcher setup",
        initials = "ST",
        screen = ToneScreen.Settings,
        colors = listOf(Color(0xFFB998FF), Color(0xFF55C8FF), Color(0xFF10122B)),
    ),
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences("toneos_launcher", Context.MODE_PRIVATE)

        setContent {
            ToneOSLauncher(
                loadApps = { loadLaunchableApps() },
                launchApp = { packageName -> launchPackage(packageName) },
                openHomeSettings = { openHomeSettings() },
                readPreference = { key -> prefs.getString(key, "") ?: "" },
                writePreference = { key, value -> prefs.edit().putString(key, value).apply() },
            )
        }
    }

    private fun loadLaunchableApps(): List<LauncherApp> {
        val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val activities = if (Build.VERSION.SDK_INT >= 33) {
            packageManager.queryIntentActivities(launcherIntent, PackageManager.ResolveInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            packageManager.queryIntentActivities(launcherIntent, 0)
        }

        return activities
            .mapNotNull { info ->
                val activityInfo = info.activityInfo ?: return@mapNotNull null
                val packageName = activityInfo.packageName
                if (packageName == this.packageName) return@mapNotNull null
                LauncherApp(
                    label = info.loadLabel(packageManager).toString(),
                    packageName = packageName,
                )
            }
            .distinctBy { it.packageName }
            .sortedBy { it.label.lowercase() }
    }

    private fun launchPackage(packageName: String) {
        val intent = packageManager.getLaunchIntentForPackage(packageName) ?: return
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)
    }

    private fun openHomeSettings() {
        val intent = Intent(Settings.ACTION_HOME_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)
    }
}

@Composable
fun ToneOSLauncher(
    loadApps: () -> List<LauncherApp>,
    launchApp: (String) -> Unit,
    openHomeSettings: () -> Unit,
    readPreference: (String) -> String,
    writePreference: (String, String) -> Unit,
) {
    var apps by remember { mutableStateOf(emptyList<LauncherApp>()) }
    var activeScreen by remember { mutableStateOf<ToneScreen?>(null) }
    var appDrawerOpen by remember { mutableStateOf(false) }
    var appQuery by remember { mutableStateOf("") }
    var serverUrl by remember { mutableStateOf(readPreference("server_url")) }
    var serverPin by remember { mutableStateOf(readPreference("server_pin")) }
    var remoteStatus by remember { mutableStateOf("Ready") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        apps = loadApps()
    }

    MaterialTheme {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(ToneWallpaper),
        ) {
            when (activeScreen) {
                ToneScreen.MediaCenter -> MediaCenterScreen(
                    serverUrl = serverUrl,
                    serverPin = serverPin,
                    onServerUrlChange = {
                        serverUrl = it
                        writePreference("server_url", it)
                    },
                    onServerPinChange = {
                        serverPin = it
                        writePreference("server_pin", it)
                    },
                )
                ToneScreen.Apps -> AppsScreen(
                    apps = apps,
                    query = appQuery,
                    onQueryChange = { appQuery = it },
                    launchApp = launchApp,
                )
                ToneScreen.Remote -> RemoteScreen(
                    serverUrl = serverUrl,
                    serverPin = serverPin,
                    status = remoteStatus,
                    onServerUrlChange = {
                        serverUrl = it
                        writePreference("server_url", it)
                    },
                    onServerPinChange = {
                        serverPin = it
                        writePreference("server_pin", it)
                    },
                    onCommand = { command ->
                        remoteStatus = "Sending ${command.second}"
                        scope.launch {
                            remoteStatus = postRemoteCommand(serverUrl, serverPin, command.first)
                        }
                    },
                )
                ToneScreen.Settings -> SettingsScreen(
                    serverUrl = serverUrl,
                    serverPin = serverPin,
                    onServerUrlChange = {
                        serverUrl = it
                        writePreference("server_url", it)
                    },
                    onServerPinChange = {
                        serverPin = it
                        writePreference("server_pin", it)
                    },
                    openHomeSettings = openHomeSettings,
                )
                null -> DesktopScreen(
                    installedApps = apps.take(6),
                    launchApp = launchApp,
                    openToneApp = {
                        activeScreen = it
                        appDrawerOpen = false
                    },
                )
            }

            StatusPill(modifier = Modifier.align(Alignment.TopEnd))

            if (appDrawerOpen) {
                AppDrawer(
                    activeScreen = activeScreen,
                    openToneApp = {
                        activeScreen = it
                        appDrawerOpen = false
                    },
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            }

            ToneTaskbar(
                appDrawerOpen = appDrawerOpen,
                onDrawerToggle = { appDrawerOpen = !appDrawerOpen },
                onBack = {
                    if (appDrawerOpen) {
                        appDrawerOpen = false
                    } else {
                        activeScreen = null
                    }
                },
                onApps = {
                    activeScreen = ToneScreen.Apps
                    appDrawerOpen = false
                },
                onHome = {
                    activeScreen = null
                    appDrawerOpen = false
                },
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

private val ToneWallpaper = Brush.linearGradient(
    colors = listOf(
        Color(0xFFB95AA7),
        Color(0xFF6671DA),
        Color(0xFF35C4E6),
    ),
)

@Composable
fun StatusPill(modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.padding(top = 18.dp, end = 18.dp),
        color = Color(0xD610122B),
        shape = RoundedCornerShape(10.dp),
        shadowElevation = 10.dp,
    ) {
        Text(
            text = "Wi-Fi  ToneOS",
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            color = Color.White,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun DesktopScreen(
    installedApps: List<LauncherApp>,
    launchApp: (String) -> Unit,
    openToneApp: (ToneScreen) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp, vertical = 34.dp)
            .padding(bottom = 86.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Spacer(modifier = Modifier.height(22.dp))
        Text("TONEOS", color = Color.White.copy(alpha = 0.74f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
        Text("Android Launcher", color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.SemiBold)

        HeroPanel(openToneApp)

        Text("Pinned", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
        LazyVerticalGrid(
            modifier = Modifier.weight(1f),
            columns = GridCells.Adaptive(minSize = 150.dp),
            contentPadding = PaddingValues(bottom = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            items(toneApps) { app ->
                ToneAppTile(app = app, selected = false, onClick = { openToneApp(app.screen) })
            }
            items(installedApps) { app ->
                InstalledAppTile(app = app, launchApp = launchApp)
            }
        }
    }
}

@Composable
fun HeroPanel(openToneApp: (ToneScreen) -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xB810122B),
        shape = RoundedCornerShape(28.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        shadowElevation = 18.dp,
    ) {
        Row(
            modifier = Modifier.padding(18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                AppIcon(initials = "MC", colors = toneApps.first().colors, size = 82)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("MediaCenter", color = Color.White, fontSize = 31.sp, fontWeight = FontWeight.SemiBold)
                    Text("Watch your ToneOS library from the home theater PC.", color = Color.White.copy(alpha = 0.74f), fontSize = 15.sp)
                }
            }
            Button(
                onClick = { openToneApp(ToneScreen.MediaCenter) },
                colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                shape = RoundedCornerShape(999.dp),
            ) {
                Text("Open", color = Color(0xFF11152A), fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun AppDrawer(
    activeScreen: ToneScreen?,
    openToneApp: (ToneScreen) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .padding(bottom = 96.dp)
            .fillMaxWidth(0.9f)
            .widthIn(max = 620.dp),
        color = Color(0xEC10122B),
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
        shadowElevation = 26.dp,
    ) {
        LazyVerticalGrid(
            modifier = Modifier
                .heightIn(max = 340.dp)
                .padding(16.dp),
            columns = GridCells.Fixed(2),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(toneApps) { app ->
                ToneAppTile(
                    app = app,
                    selected = activeScreen == app.screen,
                    onClick = { openToneApp(app.screen) },
                )
            }
        }
    }
}

@Composable
fun ToneTaskbar(
    appDrawerOpen: Boolean,
    onDrawerToggle: () -> Unit,
    onBack: () -> Unit,
    onApps: () -> Unit,
    onHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.padding(bottom = 18.dp),
        color = Color(0xE610122B),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        shadowElevation = 18.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TaskButton(label = "O", selected = appDrawerOpen, onClick = onDrawerToggle)
            TaskButton(label = "<", selected = false, onClick = onBack)
            TaskButton(label = "[]", selected = false, onClick = onApps)
            TaskButton(label = "^", selected = false, onClick = onHome)
        }
    }
}

@Composable
fun TaskButton(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .size(54.dp)
            .clickable(onClick = onClick),
        color = if (selected) Color.White.copy(alpha = 0.12f) else Color.Transparent,
        shape = RoundedCornerShape(14.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(label, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun ToneAppTile(app: ToneApp, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(82.dp)
            .clickable(onClick = onClick),
        color = if (selected) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.05f),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = if (selected) 0.42f else 0.10f)),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIcon(initials = app.initials, colors = app.colors, size = 54)
            Column {
                Text(app.title, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                Text(app.subtitle, color = Color.White.copy(alpha = 0.65f), fontSize = 12.sp, maxLines = 1)
            }
        }
    }
}

@Composable
fun InstalledAppTile(app: LauncherApp, launchApp: (String) -> Unit) {
    Card(
        onClick = { launchApp(app.packageName) },
        colors = CardDefaults.cardColors(containerColor = Color(0xB810122B)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.10f)),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AppIcon(
                initials = app.label.firstOrNull()?.uppercase() ?: "A",
                colors = listOf(Color(0xFF55C8FF), Color(0xFF6957FF)),
                size = 54,
            )
            Text(app.label, color = Color.White, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun AppIcon(initials: String, colors: List<Color>, size: Int) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(RoundedCornerShape((size / 3).dp))
            .background(Brush.linearGradient(colors)),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            modifier = Modifier.size((size * 0.56f).dp),
            color = Color.Transparent,
            shape = CircleShape,
            border = BorderStroke(2.dp, Color.White.copy(alpha = 0.68f)),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(initials.take(2), color = Color.White, fontSize = (size / 4).sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun MediaCenterScreen(
    serverUrl: String,
    serverPin: String,
    onServerUrlChange: (String) -> Unit,
    onServerPinChange: (String) -> Unit,
) {
    if (serverUrl.isBlank()) {
        ServerSetupScreen(
            title = "MediaCenter",
            serverUrl = serverUrl,
            serverPin = serverPin,
            onServerUrlChange = onServerUrlChange,
            onServerPinChange = onServerPinChange,
        )
        return
    }

    Box(modifier = Modifier.fillMaxSize()) {
        ToneWebClient(url = "${normalizeServerUrl(serverUrl)}/client")
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun ToneWebClient(url: String) {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            WebView(context).apply {
                webViewClient = WebViewClient()
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.cacheMode = WebSettings.LOAD_DEFAULT
                loadUrl(url)
            }
        },
        update = { webView ->
            if (webView.url != url) {
                webView.loadUrl(url)
            }
        },
    )
}

@Composable
fun AppsScreen(
    apps: List<LauncherApp>,
    query: String,
    onQueryChange: (String) -> Unit,
    launchApp: (String) -> Unit,
) {
    val filteredApps = apps.filter { it.label.contains(query, ignoreCase = true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp, vertical = 34.dp)
            .padding(bottom = 86.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ScreenTitle(kicker = "TONEOS", title = "Apps")
        PillTextField(
            value = query,
            onValueChange = onQueryChange,
            label = "Search apps",
        )
        LazyVerticalGrid(
            modifier = Modifier.weight(1f),
            columns = GridCells.Adaptive(minSize = 150.dp),
            contentPadding = PaddingValues(bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            items(filteredApps) { app ->
                InstalledAppTile(app = app, launchApp = launchApp)
            }
        }
    }
}

@Composable
fun SettingsScreen(
    serverUrl: String,
    serverPin: String,
    onServerUrlChange: (String) -> Unit,
    onServerPinChange: (String) -> Unit,
    openHomeSettings: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp, vertical = 34.dp)
            .padding(bottom = 86.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ScreenTitle(kicker = "TONEOS", title = "Settings")

        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xB810122B),
            shape = RoundedCornerShape(26.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("MediaCenter", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
                PillTextField(value = serverUrl, onValueChange = onServerUrlChange, label = "ToneOS server URL")
                PillTextField(
                    value = serverPin,
                    onValueChange = onServerPinChange,
                    label = "PIN",
                    password = true,
                )
            }
        }

        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xB810122B),
            shape = RoundedCornerShape(26.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        ) {
            Row(
                modifier = Modifier.padding(18.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("Launcher", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
                    Text("Default home app", color = Color.White.copy(alpha = 0.66f), fontSize = 14.sp)
                }
                Button(
                    onClick = openHomeSettings,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                    shape = RoundedCornerShape(999.dp),
                ) {
                    Text("Choose", color = Color(0xFF11152A), fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
fun ServerSetupScreen(
    title: String,
    serverUrl: String,
    serverPin: String,
    onServerUrlChange: (String) -> Unit,
    onServerPinChange: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp, vertical = 34.dp)
            .padding(bottom = 86.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ScreenTitle(kicker = "MEDIACENTER", title = title)
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xB810122B),
            shape = RoundedCornerShape(28.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        ) {
            Row(
                modifier = Modifier.padding(18.dp),
                horizontalArrangement = Arrangement.spacedBy(18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AppIcon(initials = "MC", colors = toneApps.first().colors, size = 96)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Connect to ToneOS", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.SemiBold)
                    PillTextField(value = serverUrl, onValueChange = onServerUrlChange, label = "Server URL")
                    PillTextField(
                        value = serverPin,
                        onValueChange = onServerPinChange,
                        label = "PIN",
                        password = true,
                    )
                }
            }
        }
    }
}

@Composable
fun RemoteScreen(
    serverUrl: String,
    serverPin: String,
    status: String,
    onServerUrlChange: (String) -> Unit,
    onServerPinChange: (String) -> Unit,
    onCommand: (Pair<String, String>) -> Unit,
) {
    val commands = listOf(
        "home" to "Home",
        "mediacenter" to "MediaCenter",
        "media:movies" to "Movies",
        "media:tv" to "TV Shows",
        "media:streaming" to "Streaming",
        "media:music" to "Music",
        "media:books" to "Books",
        "media:games" to "Games",
        "browser" to "Browser",
        "settings" to "Settings",
        "task-switcher" to "Task Manager",
        "close-active" to "Close Active",
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp, vertical = 34.dp)
            .padding(bottom = 86.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ScreenTitle(kicker = "TONEOS", title = "PC Remote")
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xB810122B),
            shape = RoundedCornerShape(26.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(status, color = Color.White.copy(alpha = 0.72f))
                PillTextField(value = serverUrl, onValueChange = onServerUrlChange, label = "ToneOS server URL")
                PillTextField(value = serverPin, onValueChange = onServerPinChange, label = "PIN", password = true)
            }
        }

        LazyVerticalGrid(
            modifier = Modifier.weight(1f),
            columns = GridCells.Adaptive(minSize = 150.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(commands) { command ->
                Button(
                    onClick = { onCommand(command) },
                    modifier = Modifier.height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xD8151836)),
                    shape = RoundedCornerShape(999.dp),
                ) {
                    Text(command.second, color = Color.White, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
fun ScreenTitle(kicker: String, title: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(kicker, color = Color.White.copy(alpha = 0.72f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
        Text(title, color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun PillTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    password: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text(label) },
        shape = RoundedCornerShape(999.dp),
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
    )
}

suspend fun postRemoteCommand(serverUrl: String, pin: String, command: String): String = withContext(Dispatchers.IO) {
    val baseUrl = normalizeServerUrl(serverUrl)
    if (baseUrl.isBlank()) {
        return@withContext "Enter the ToneOS Media Server URL first."
    }

    runCatching {
        val connection = (URL("$baseUrl/api/remote").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 5000
            readTimeout = 5000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            if (pin.isNotBlank()) {
                setRequestProperty("X-ToneOS-PIN", pin)
            }
        }
        val body = JSONObject().put("command", command).put("payload", JSONObject()).toString()
        connection.outputStream.use { output ->
            output.write(body.toByteArray(Charsets.UTF_8))
        }
        val responseCode = connection.responseCode
        if (responseCode in 200..299) {
            "Sent $command to ToneOS."
        } else {
            val error = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
            "ToneOS returned $responseCode ${error.take(120)}"
        }
    }.getOrElse { error ->
        "Could not reach ToneOS: ${error.message ?: "network error"}"
    }
}

fun normalizeServerUrl(value: String): String {
    val trimmed = value.trim().trimEnd('/')
    if (trimmed.isBlank()) return ""
    return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) trimmed else "http://$trimmed"
}
