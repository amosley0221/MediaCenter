package com.toneos.launcher

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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

enum class ToneScreen(val label: String) {
    Home("Home"),
    Apps("Apps"),
    Remote("PC Remote"),
}

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
    var query by remember { mutableStateOf("") }
    var screen by remember { mutableStateOf(ToneScreen.Home) }
    var serverUrl by remember { mutableStateOf(readPreference("server_url")) }
    var serverPin by remember { mutableStateOf(readPreference("server_pin")) }
    var remoteStatus by remember { mutableStateOf("Enter your ToneOS Media Server URL to control the PC.") }
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
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                ToneTopBar(screen, onScreenChange = { screen = it }, openHomeSettings = openHomeSettings)

                when (screen) {
                    ToneScreen.Home -> HomeScreen(
                        apps = apps.take(12),
                        launchApp = launchApp,
                        openRemote = { screen = ToneScreen.Remote },
                    )
                    ToneScreen.Apps -> AppsScreen(
                        apps = apps,
                        query = query,
                        onQueryChange = { query = it },
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
                            remoteStatus = "Sending $command..."
                            scope.launch {
                                remoteStatus = postRemoteCommand(serverUrl, serverPin, command)
                            }
                        },
                    )
                }
            }
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
fun ToneTopBar(
    selected: ToneScreen,
    onScreenChange: (ToneScreen) -> Unit,
    openHomeSettings: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xAA10122B),
        shape = RoundedCornerShape(28.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
        shadowElevation = 12.dp,
    ) {
        Row(
            modifier = Modifier.padding(18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("TONEOS", color = Color.White.copy(alpha = 0.68f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Text("Android Launcher", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Black)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                ToneScreen.entries.forEach { screen ->
                    FilterChip(
                        selected = selected == screen,
                        onClick = { onScreenChange(screen) },
                        label = { Text(screen.label) },
                    )
                }
                Button(onClick = openHomeSettings, colors = ButtonDefaults.buttonColors(containerColor = Color.White)) {
                    Text("Set Home", color = Color(0xFF11152A))
                }
            }
        }
    }
}

@Composable
fun HomeScreen(
    apps: List<LauncherApp>,
    launchApp: (String) -> Unit,
    openRemote: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        HeroCard(openRemote)
        Text("Favorite Apps", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
        AppGrid(apps = apps, launchApp = launchApp, modifier = Modifier.weight(1f))
    }
}

@Composable
fun HeroCard(openRemote: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xB810122B),
        shape = RoundedCornerShape(26.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("MEDIA CENTER CLIENT", color = Color.White.copy(alpha = 0.68f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Text("Control ToneOS from Android", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Black)
                Text(
                    "Launch apps, send ToneOS commands, and use this as the base for the future mobile MediaCenter client.",
                    color = Color.White.copy(alpha = 0.76f),
                    fontSize = 16.sp,
                )
            }
            Button(onClick = openRemote, colors = ButtonDefaults.buttonColors(containerColor = Color.White)) {
                Text("Open Remote", color = Color(0xFF11152A), fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun AppsScreen(
    apps: List<LauncherApp>,
    query: String,
    onQueryChange: (String) -> Unit,
    launchApp: (String) -> Unit,
) {
    val filteredApps = apps.filter { it.label.contains(query, ignoreCase = true) }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Search installed apps") },
        )
        AppGrid(apps = filteredApps, launchApp = launchApp, modifier = Modifier.weight(1f))
    }
}

@Composable
fun AppGrid(apps: List<LauncherApp>, launchApp: (String) -> Unit, modifier: Modifier = Modifier) {
    LazyVerticalGrid(
        modifier = modifier,
        columns = GridCells.Adaptive(minSize = 156.dp),
        contentPadding = PaddingValues(bottom = 24.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        items(apps) { app ->
            AppTile(app = app, launchApp = launchApp)
        }
    }
}

@Composable
fun AppTile(app: LauncherApp, launchApp: (String) -> Unit) {
    Card(
        onClick = { launchApp(app.packageName) },
        colors = CardDefaults.cardColors(containerColor = Color(0xC210122B)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.10f)),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF7ED957), Color(0xFF55C8FF), Color(0xFF6957FF)))),
                contentAlignment = Alignment.Center,
            ) {
                Text(app.label.firstOrNull()?.uppercase() ?: "A", color = Color.White, fontWeight = FontWeight.Black)
            }
            Text(app.label, color = Color.White, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
    onCommand: (String) -> Unit,
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

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xB810122B),
            shape = RoundedCornerShape(24.dp),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("ToneOS PC Remote", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
                Text(status, color = Color.White.copy(alpha = 0.72f))
                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = onServerUrlChange,
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("ToneOS server URL") },
                    placeholder = { Text("http://192.168.1.50:8096") },
                )
                OutlinedTextField(
                    value = serverPin,
                    onValueChange = onServerPinChange,
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("PIN / password") },
                )
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
                    onClick = { onCommand(command.first) },
                    modifier = Modifier.height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xD8151836)),
                ) {
                    Text(command.second, color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
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
