package com.toneos.launcher

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.layout.offset
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
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
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

enum class ToneTheme(val label: String) {
    Default("Default"),
    BlackGold("Black and gold"),
}

enum class ToneWallpaperOption(val label: String) {
    Default("Default gradient"),
    DefaultTone("Default with ToneOS"),
    BlackGold("Black and gold"),
    BlackGoldTone("Black and gold with ToneOS"),
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
        hideSystemBars()

        val prefs = getSharedPreferences("toneos_launcher", Context.MODE_PRIVATE)

        setContent {
            ToneOSLauncher(
                loadApps = { loadLaunchableApps() },
                launchApp = { packageName -> launchPackage(packageName) },
                openHomeSettings = { openHomeSettings() },
                showNativeBars = { showSystemBars() },
                hideNativeBars = { hideSystemBars() },
                readPreference = { key -> prefs.getString(key, "") ?: "" },
                writePreference = { key, value -> prefs.edit().putString(key, value).apply() },
            )
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemBars()
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

    private fun hideSystemBars() {
        runCatching {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            WindowInsetsControllerCompat(window, window.decorView).apply {
                hide(WindowInsetsCompat.Type.systemBars())
                systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        }.onFailure {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    @Suppress("DEPRECATION")
    private fun showSystemBars() {
        runCatching {
            WindowInsetsControllerCompat(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
            WindowCompat.setDecorFitsSystemWindows(window, true)
        }.onFailure {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }
}

@Composable
fun ToneOSLauncher(
    loadApps: () -> List<LauncherApp>,
    launchApp: (String) -> Unit,
    openHomeSettings: () -> Unit,
    showNativeBars: () -> Unit,
    hideNativeBars: () -> Unit,
    readPreference: (String) -> String,
    writePreference: (String, String) -> Unit,
) {
    var apps by remember { mutableStateOf(emptyList<LauncherApp>()) }
    var activeScreen by remember { mutableStateOf<ToneScreen?>(null) }
    var openScreens by remember { mutableStateOf(emptySet<ToneScreen>()) }
    var appDrawerOpen by remember { mutableStateOf(false) }
    var taskSwitcherOpen by remember { mutableStateOf(false) }
    var appQuery by remember { mutableStateOf("") }
    var serverUrl by remember { mutableStateOf(readPreference("server_url")) }
    var serverPin by remember { mutableStateOf(readPreference("server_pin")) }
    var theme by remember { mutableStateOf(parseTheme(readPreference("appearance_theme"))) }
    var wallpaper by remember { mutableStateOf(parseWallpaper(readPreference("appearance_wallpaper"))) }
    var remoteStatus by remember { mutableStateOf("Ready") }
    val scope = rememberCoroutineScope()
    val openToneApp: (ToneScreen) -> Unit = { screen ->
        activeScreen = screen
        openScreens = openScreens + screen
        appDrawerOpen = false
        taskSwitcherOpen = false
    }
    val closeScreen: (ToneScreen) -> Unit = { screen ->
        openScreens = openScreens - screen
        if (activeScreen == screen) {
            activeScreen = openScreens.minus(screen).lastOrNull()
        }
    }

    LaunchedEffect(Unit) {
        apps = loadApps()
    }

    MaterialTheme {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(baseWallpaperBrush(theme, wallpaper)),
        ) {
            WallpaperLayer(theme = theme, wallpaper = wallpaper)

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
                    theme = theme,
                    wallpaper = wallpaper,
                    onServerUrlChange = {
                        serverUrl = it
                        writePreference("server_url", it)
                    },
                    onServerPinChange = {
                        serverPin = it
                        writePreference("server_pin", it)
                    },
                    onThemeChange = {
                        theme = it
                        writePreference("appearance_theme", it.name)
                    },
                    onWallpaperChange = {
                        wallpaper = it
                        writePreference("appearance_wallpaper", it.name)
                    },
                    openHomeSettings = openHomeSettings,
                )
                null -> DesktopScreen(
                    theme = theme,
                    wallpaper = wallpaper,
                    onNativeBarsRequest = {
                        scope.launch {
                            showNativeBars()
                            delay(3500)
                            hideNativeBars()
                        }
                    },
                )
            }

            TopRightControls(
                theme = theme,
                wallpaper = wallpaper,
                modifier = Modifier.align(Alignment.TopEnd),
            )

            if (appDrawerOpen) {
                AppDrawer(
                    activeScreen = activeScreen,
                    openToneApp = openToneApp,
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            }

            if (taskSwitcherOpen) {
                TaskSwitcher(
                    openScreens = openScreens,
                    activeScreen = activeScreen,
                    openToneApp = openToneApp,
                    closeScreen = closeScreen,
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            }

            ToneTaskbar(
                appDrawerOpen = appDrawerOpen,
                taskSwitcherOpen = taskSwitcherOpen,
                onDrawerToggle = {
                    appDrawerOpen = !appDrawerOpen
                    taskSwitcherOpen = false
                },
                onBack = {
                    if (appDrawerOpen) {
                        appDrawerOpen = false
                    } else if (taskSwitcherOpen) {
                        taskSwitcherOpen = false
                    } else {
                        activeScreen?.let(closeScreen)
                    }
                },
                onTasks = {
                    taskSwitcherOpen = !taskSwitcherOpen
                    appDrawerOpen = false
                },
                onHome = {
                    activeScreen = null
                    appDrawerOpen = false
                    taskSwitcherOpen = false
                },
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

fun parseTheme(value: String): ToneTheme =
    ToneTheme.entries.firstOrNull { it.name == value } ?: ToneTheme.Default

fun parseWallpaper(value: String): ToneWallpaperOption =
    ToneWallpaperOption.entries.firstOrNull { it.name == value } ?: ToneWallpaperOption.Default

fun isGoldWallpaper(theme: ToneTheme, wallpaper: ToneWallpaperOption): Boolean =
    theme == ToneTheme.BlackGold ||
        wallpaper == ToneWallpaperOption.BlackGold ||
        wallpaper == ToneWallpaperOption.BlackGoldTone

fun baseWallpaperBrush(theme: ToneTheme, wallpaper: ToneWallpaperOption): Brush =
    if (isGoldWallpaper(theme, wallpaper)) {
        Brush.linearGradient(
            listOf(
                Color(0xFF040404),
                Color(0xFF11100C),
                Color(0xFF2A1D08),
                Color(0xFF060606),
            ),
        )
    } else {
        Brush.linearGradient(
            listOf(
                Color(0xFFDB61AE),
                Color(0xFF5B75D8),
                Color(0xFF38B7EE),
                Color(0xFF7A5CF3),
            ),
        )
    }

@Composable
fun WallpaperLayer(theme: ToneTheme, wallpaper: ToneWallpaperOption) {
    val gold = isGoldWallpaper(theme, wallpaper)
    Canvas(modifier = Modifier.fillMaxSize()) {
        val gridColor = if (gold) Color(0xFFFFCC56).copy(alpha = 0.08f) else Color.White.copy(alpha = 0.024f)
        val step = 44.dp.toPx()
        var x = 0f
        while (x <= size.width) {
            drawLine(gridColor, start = androidx.compose.ui.geometry.Offset(x, 0f), end = androidx.compose.ui.geometry.Offset(x, size.height), strokeWidth = 1f)
            x += step
        }
        var y = 0f
        while (y <= size.height) {
            drawLine(gridColor, start = androidx.compose.ui.geometry.Offset(0f, y), end = androidx.compose.ui.geometry.Offset(size.width, y), strokeWidth = 1f)
            y += step
        }

        if (gold) {
            drawCircle(Color(0xFFFFB22B).copy(alpha = 0.24f), radius = size.minDimension * 0.32f, center = androidx.compose.ui.geometry.Offset(size.width * 0.18f, size.height * 0.25f))
            drawCircle(Color(0xFFFFDA6A).copy(alpha = 0.16f), radius = size.minDimension * 0.34f, center = androidx.compose.ui.geometry.Offset(size.width * 0.78f, size.height * 0.14f))
            drawCircle(Color(0xFF91580A).copy(alpha = 0.28f), radius = size.minDimension * 0.38f, center = androidx.compose.ui.geometry.Offset(size.width * 0.74f, size.height * 0.93f))
        } else {
            drawCircle(Color(0xFFF03AA5).copy(alpha = 0.42f), radius = size.minDimension * 0.28f, center = androidx.compose.ui.geometry.Offset(size.width * 0.14f, size.height * 0.31f))
            drawCircle(Color(0xFF4BBDFF).copy(alpha = 0.46f), radius = size.minDimension * 0.34f, center = androidx.compose.ui.geometry.Offset(size.width * 0.82f, size.height * 0.19f))
            drawCircle(Color(0xFF773FFF).copy(alpha = 0.40f), radius = size.minDimension * 0.36f, center = androidx.compose.ui.geometry.Offset(size.width * 0.70f, size.height * 0.94f))
        }
    }

    if (wallpaper == ToneWallpaperOption.DefaultTone || wallpaper == ToneWallpaperOption.BlackGoldTone) {
        WallpaperBrand(gold = gold)
    }
}

@Composable
fun WallpaperBrand(gold: Boolean) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Box(modifier = Modifier.offset(x = (-8).dp, y = (-6).dp)) {
            Text(
                text = "TONEOS",
                color = if (gold) Color(0xFFFFEC97).copy(alpha = 0.36f) else Color(0xFF00F0FF).copy(alpha = 0.46f),
                fontSize = 92.sp,
                fontWeight = FontWeight.Black,
                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
            )
        }
        Box(modifier = Modifier.offset(x = 7.dp, y = 6.dp)) {
            Text(
                text = "TONEOS",
                color = if (gold) Color(0xFF5B3103).copy(alpha = 0.54f) else Color(0xFFFF15B0).copy(alpha = 0.46f),
                fontSize = 92.sp,
                fontWeight = FontWeight.Black,
                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
            )
        }
        Text(
            text = "TONEOS",
            color = if (gold) Color(0xFFD6A93B).copy(alpha = 0.78f) else Color.Black.copy(alpha = 0.74f),
            fontSize = 92.sp,
            fontWeight = FontWeight.Black,
            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
        )
    }
}

@Composable
fun TopRightControls(
    theme: ToneTheme,
    wallpaper: ToneWallpaperOption,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.padding(top = 22.dp, end = 26.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            color = if (isGoldWallpaper(theme, wallpaper)) Color(0xD6080704) else Color(0xD6080D1D),
            shape = RoundedCornerShape(6.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
            shadowElevation = 10.dp,
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MiniWifiIcon()
                MiniLocationIcon()
                MiniSignalIcon()
                Text("ToneOS", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun MiniWifiIcon() {
    Canvas(modifier = Modifier.size(18.dp)) {
        val stroke = Stroke(width = 1.8.dp.toPx())
        drawArc(Color.White.copy(alpha = 0.9f), startAngle = 215f, sweepAngle = 110f, useCenter = false, topLeft = androidx.compose.ui.geometry.Offset(size.width * 0.13f, size.height * 0.24f), size = androidx.compose.ui.geometry.Size(size.width * 0.74f, size.height * 0.74f), style = stroke)
        drawArc(Color.White.copy(alpha = 0.9f), startAngle = 220f, sweepAngle = 100f, useCenter = false, topLeft = androidx.compose.ui.geometry.Offset(size.width * 0.30f, size.height * 0.43f), size = androidx.compose.ui.geometry.Size(size.width * 0.40f, size.height * 0.40f), style = stroke)
        drawCircle(Color.White.copy(alpha = 0.9f), radius = 1.6.dp.toPx(), center = androidx.compose.ui.geometry.Offset(size.width / 2f, size.height * 0.82f))
    }
}

@Composable
fun MiniLocationIcon() {
    Canvas(modifier = Modifier.size(18.dp)) {
        val stroke = Stroke(width = 1.8.dp.toPx())
        drawCircle(Color.White.copy(alpha = 0.9f), radius = size.minDimension * 0.26f, center = androidx.compose.ui.geometry.Offset(size.width / 2f, size.height * 0.42f), style = stroke)
        drawLine(Color.White.copy(alpha = 0.9f), start = androidx.compose.ui.geometry.Offset(size.width / 2f, size.height * 0.70f), end = androidx.compose.ui.geometry.Offset(size.width / 2f, size.height * 0.92f), strokeWidth = 1.8.dp.toPx())
    }
}

@Composable
fun MiniSignalIcon() {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.Bottom) {
        listOf(7.dp, 11.dp, 15.dp).forEach { barHeight ->
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(barHeight)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color.White.copy(alpha = 0.9f)),
            )
        }
    }
}

@Composable
fun <T> OptionRow(options: List<T>, selected: T, label: (T) -> String, onSelect: (T) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { option ->
            OptionButton(
                label = label(option),
                selected = selected == option,
                onClick = { onSelect(option) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
fun OptionButton(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier
            .height(42.dp)
            .clickable(onClick = onClick),
        color = if (selected) Color.White.copy(alpha = 0.16f) else Color.White.copy(alpha = 0.06f),
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = if (selected) 0.42f else 0.10f)),
    ) {
        Box(modifier = Modifier.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
            Text(label, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun DesktopScreen(
    theme: ToneTheme,
    wallpaper: ToneWallpaperOption,
    onNativeBarsRequest: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTapGestures(onDoubleTap = { onNativeBarsRequest() })
            },
    ) {
        if (wallpaper == ToneWallpaperOption.Default && theme == ToneTheme.Default) {
            Spacer(modifier = Modifier.size(1.dp))
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
            .padding(bottom = 82.dp)
            .fillMaxWidth(0.74f)
            .widthIn(min = 360.dp, max = 560.dp),
        color = Color(0xEC10122B),
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
        shadowElevation = 26.dp,
    ) {
        LazyVerticalGrid(
            modifier = Modifier
                .heightIn(max = 390.dp)
                .padding(18.dp),
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
    taskSwitcherOpen: Boolean,
    onDrawerToggle: () -> Unit,
    onBack: () -> Unit,
    onTasks: () -> Unit,
    onHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.padding(bottom = 18.dp),
        color = Color(0xE610122B),
        shape = RoundedCornerShape(7.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.07f)),
        shadowElevation = 18.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 7.dp),
            horizontalArrangement = Arrangement.spacedBy(0.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TaskButton(icon = TaskIcon.Start, selected = appDrawerOpen, onClick = onDrawerToggle)
            TaskButton(icon = TaskIcon.Back, selected = false, onClick = onBack)
            TaskButton(icon = TaskIcon.Tasks, selected = taskSwitcherOpen, onClick = onTasks)
            TaskButton(icon = TaskIcon.Home, selected = false, onClick = onHome)
        }
    }
}

enum class TaskIcon {
    Start,
    Back,
    Tasks,
    Home,
}

@Composable
fun TaskButton(icon: TaskIcon, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .size(width = 58.dp, height = 53.dp)
            .clickable(onClick = onClick),
        color = if (selected) Color.White.copy(alpha = 0.10f) else Color.Transparent,
        shape = RoundedCornerShape(7.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            TaskIconCanvas(icon = icon, selected = selected)
        }
    }
}

@Composable
fun TaskIconCanvas(icon: TaskIcon, selected: Boolean) {
    Canvas(modifier = Modifier.size(30.dp)) {
        val color = Color.White.copy(alpha = if (selected) 1f else 0.92f)
        val strokeWidth = 2.7.dp.toPx()
        val stroke = Stroke(width = strokeWidth)
        when (icon) {
            TaskIcon.Start -> {
                drawCircle(color, radius = size.minDimension * 0.34f, style = Stroke(width = 4.dp.toPx()))
            }
            TaskIcon.Back -> {
                drawLine(color, start = androidx.compose.ui.geometry.Offset(size.width * 0.62f, size.height * 0.22f), end = androidx.compose.ui.geometry.Offset(size.width * 0.36f, size.height * 0.50f), strokeWidth = strokeWidth)
                drawLine(color, start = androidx.compose.ui.geometry.Offset(size.width * 0.36f, size.height * 0.50f), end = androidx.compose.ui.geometry.Offset(size.width * 0.62f, size.height * 0.78f), strokeWidth = strokeWidth)
            }
            TaskIcon.Tasks -> {
                drawRoundRect(
                    color = color,
                    topLeft = androidx.compose.ui.geometry.Offset(size.width * 0.31f, size.height * 0.31f),
                    size = androidx.compose.ui.geometry.Size(size.width * 0.38f, size.height * 0.38f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(3.dp.toPx(), 3.dp.toPx()),
                    style = stroke,
                )
                if (selected) {
                    drawCircle(color, radius = 2.3.dp.toPx(), center = androidx.compose.ui.geometry.Offset(size.width * 0.5f, size.height * 0.90f))
                }
            }
            TaskIcon.Home -> {
                drawLine(color, start = androidx.compose.ui.geometry.Offset(size.width * 0.20f, size.height * 0.48f), end = androidx.compose.ui.geometry.Offset(size.width * 0.50f, size.height * 0.22f), strokeWidth = strokeWidth)
                drawLine(color, start = androidx.compose.ui.geometry.Offset(size.width * 0.50f, size.height * 0.22f), end = androidx.compose.ui.geometry.Offset(size.width * 0.80f, size.height * 0.48f), strokeWidth = strokeWidth)
                drawLine(color, start = androidx.compose.ui.geometry.Offset(size.width * 0.30f, size.height * 0.43f), end = androidx.compose.ui.geometry.Offset(size.width * 0.30f, size.height * 0.78f), strokeWidth = strokeWidth)
                drawLine(color, start = androidx.compose.ui.geometry.Offset(size.width * 0.70f, size.height * 0.43f), end = androidx.compose.ui.geometry.Offset(size.width * 0.70f, size.height * 0.78f), strokeWidth = strokeWidth)
                drawLine(color, start = androidx.compose.ui.geometry.Offset(size.width * 0.30f, size.height * 0.78f), end = androidx.compose.ui.geometry.Offset(size.width * 0.70f, size.height * 0.78f), strokeWidth = strokeWidth)
            }
        }
    }
}

@Composable
fun TaskSwitcher(
    openScreens: Set<ToneScreen>,
    activeScreen: ToneScreen?,
    openToneApp: (ToneScreen) -> Unit,
    closeScreen: (ToneScreen) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .padding(bottom = 92.dp)
            .fillMaxWidth(0.84f)
            .widthIn(max = 900.dp),
        color = Color(0xE608091B),
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.09f)),
        shadowElevation = 24.dp,
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Task Manager", color = Color.White.copy(alpha = 0.76f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
            if (openScreens.isEmpty()) {
                Text("No open windows", color = Color.White.copy(alpha = 0.62f), fontSize = 14.sp)
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    openScreens.forEach { screen ->
                        TaskPreview(
                            screen = screen,
                            active = activeScreen == screen,
                            openToneApp = openToneApp,
                            closeScreen = closeScreen,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TaskPreview(
    screen: ToneScreen,
    active: Boolean,
    openToneApp: (ToneScreen) -> Unit,
    closeScreen: (ToneScreen) -> Unit,
    modifier: Modifier = Modifier,
) {
    val app = toneApps.firstOrNull { it.screen == screen }
    Surface(
        modifier = modifier
            .height(132.dp)
            .clickable { openToneApp(screen) },
        color = if (active) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.06f),
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = if (active) 0.42f else 0.10f)),
    ) {
        Box(modifier = Modifier.fillMaxSize().padding(10.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .clip(RoundedCornerShape(7.dp))
                        .background(Brush.linearGradient(app?.colors ?: listOf(Color(0xFF55C8FF), Color(0xFF6957FF)))),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(app?.initials ?: "OS", color = Color.White, fontWeight = FontWeight.SemiBold)
                }
                Text(app?.title ?: screen.name, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            }
            Surface(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(30.dp)
                    .clickable { closeScreen(screen) },
                color = Color(0xAA10122B),
                shape = CircleShape,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("X", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
fun ToneAppTile(app: ToneApp, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(60.dp)
            .clickable(onClick = onClick),
        color = if (selected) Color.White.copy(alpha = 0.08f) else Color.Transparent,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = if (selected) 0.52f else 0.0f)),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIcon(initials = app.initials, colors = app.colors, size = 38)
            Text(app.title, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun DrawerInstalledAppTile(app: LauncherApp, launchApp: (String) -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(60.dp)
            .clickable { launchApp(app.packageName) },
        color = Color.Transparent,
        shape = RoundedCornerShape(8.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIcon(
                initials = app.label.firstOrNull()?.uppercase() ?: "A",
                colors = listOf(Color(0xFF8EDBFF), Color(0xFF4C6DDD)),
                size = 38,
            )
            Text(app.label, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
    theme: ToneTheme,
    wallpaper: ToneWallpaperOption,
    onServerUrlChange: (String) -> Unit,
    onServerPinChange: (String) -> Unit,
    onThemeChange: (ToneTheme) -> Unit,
    onWallpaperChange: (ToneWallpaperOption) -> Unit,
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
            shape = RoundedCornerShape(8.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Themes", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
                Text("Theme", color = Color.White.copy(alpha = 0.72f), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                OptionRow(
                    options = ToneTheme.entries,
                    selected = theme,
                    label = { it.label },
                    onSelect = onThemeChange,
                )
                Text("Wallpaper", color = Color.White.copy(alpha = 0.72f), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ToneWallpaperOption.entries.forEach { option ->
                        OptionButton(
                            label = option.label,
                            selected = wallpaper == option,
                            onClick = { onWallpaperChange(option) },
                        )
                    }
                }
            }
        }

        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xB810122B),
            shape = RoundedCornerShape(8.dp),
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
            shape = RoundedCornerShape(8.dp),
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
