package com.playinfinity.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.playinfinity.app.data.Api
import com.playinfinity.app.data.AppSettings

@Composable
fun SettingsScreen(
    settings: AppSettings,
    deviceId: String,
    banned: Boolean,
    lastChecked: String,
    onRefresh: () -> Unit,
) {
    val context = LocalContext.current
    var legalTitle by remember { mutableStateOf<String?>(null) }
    var legalBody by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Text(
                text = "Settings",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Black,
            )
        }

        item {
            SettingsCard(title = "Device") {
                InfoRow("App version", settings.appVersion)
                InfoRow("Device ID", deviceId.take(18) + "…", onClick = {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("Device ID", deviceId))
                    Toast.makeText(context, "Device ID copied", Toast.LENGTH_SHORT).show()
                })
                InfoRow("Status", if (banned) "Banned" else "Active")
                InfoRow("Last check", lastChecked.ifBlank { "—" })
                Spacer(Modifier.height(10.dp))
                Button(onClick = onRefresh) { Text("Check again") }
            }
        }

        item {
            SettingsCard(title = "Playback") {
                InfoRow("Default quality", "Auto (adaptive)")
                InfoRow("Player", "Media3 ExoPlayer")
                Spacer(Modifier.height(10.dp))
                Button(onClick = {
                    Toast.makeText(context, "Cache cleared", Toast.LENGTH_SHORT).show()
                }) { Text("Clear cache") }
            }
        }

        item {
            SettingsCard(title = "Legal") {
                LegalRow("Privacy Policy") {
                    legalTitle = "Privacy Policy"
                    legalBody = settings.privacyPolicy.ifBlank { "No privacy policy published yet." }
                }
                LegalRow("Terms & Conditions") {
                    legalTitle = "Terms & Conditions"
                    legalBody = settings.termsConditions.ifBlank { "No terms published yet." }
                }
                LegalRow("Open web version") {
                    openUrl(context, Api.BASE_URL + "privacy")
                }
            }
        }

        item {
            SettingsCard(title = "About developer") {
                InfoRow("Developer", settings.developerName)
                LegalRow("Portfolio") { openUrl(context, settings.developerPortfolio) }
                LegalRow("Instagram") { openInstagram(context, settings.developerInstagram) }
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Developed by ${settings.developerName}",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item {
            SettingsCard(title = "Support") {
                LegalRow("Contact support on Instagram") {
                    openInstagram(context, settings.developerInstagram)
                }
            }
        }

        item { Spacer(Modifier.height(20.dp)) }
    }

    val title = legalTitle
    if (title != null) {
        AlertDialog(
            onDismissRequest = { legalTitle = null },
            confirmButton = { TextButton(onClick = { legalTitle = null }) { Text("Close") } },
            title = { Text(title) },
            text = {
                Text(
                    text = legalBody,
                    modifier = Modifier.height(400.dp).verticalScroll(rememberScrollState()),
                    style = MaterialTheme.typography.bodySmall,
                )
            },
        )
    }
}

@Composable
private fun SettingsCard(title: String, content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Panel), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String, onClick: (() -> Unit)? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(vertical = 5.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(text = value, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun LegalRow(label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 12.dp),
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Text(text = "›", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun openUrl(context: Context, url: String) {
    if (url.isBlank()) return
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    } catch (_: Exception) {
    }
}

private fun openInstagram(context: Context, url: String) {
    if (url.isBlank()) return
    try {
        val handle = url.trimEnd('/').substringAfterLast('/')
        val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse("http://instagram.com/_u/$handle"))
        appIntent.setPackage("com.instagram.android")
        context.startActivity(appIntent)
    } catch (_: Exception) {
        openUrl(context, url)
    }
}
