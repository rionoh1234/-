package com.rionoh.kakaobanklogger.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import com.rionoh.kakaobanklogger.forward.ForwardScheduler
import com.rionoh.kakaobanklogger.forward.Payload
import com.rionoh.kakaobanklogger.forward.WebhookClient
import com.rionoh.kakaobanklogger.settings.SettingsStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val settings = remember { SettingsStore(context) }
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    val clipboard = LocalClipboardManager.current

    var forwardEnabled by remember { mutableStateOf(settings.forwardEnabled) }
    var url by remember { mutableStateOf(settings.webhookUrl) }
    var secret by remember { mutableStateOf(settings.ensureSecret()) }
    var packages by remember { mutableStateOf(settings.packageFilter) }
    var captureAll by remember { mutableStateOf(settings.captureAllPackages) }
    var testing by remember { mutableStateOf(false) }

    fun save() {
        settings.forwardEnabled = forwardEnabled
        settings.webhookUrl = url
        settings.webhookSecret = secret
        settings.packageFilter = packages.ifBlank { SettingsStore.DEFAULT_PACKAGES }
        settings.captureAllPackages = captureAll
        if (forwardEnabled && settings.isWebhookConfigured()) ForwardScheduler.enqueueNow(context)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("설정") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbar) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("웹훅 전송", style = MaterialTheme.typography.titleMedium)
            Text(
                "수집된 알림을 HTTPS 주소로 JSON 전송합니다. 보통 Google Apps Script 웹앱 주소를 넣어 " +
                    "Google 스프레드시트에 쌓고, Claude 가 그 시트를 읽습니다. 끄면 기기 안에만 보관됩니다.",
                style = MaterialTheme.typography.bodySmall
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(checked = forwardEnabled, onCheckedChange = { forwardEnabled = it })
                Spacer(Modifier.width(8.dp))
                Text("웹훅 전송 사용")
            }
            OutlinedTextField(
                value = url,
                onValueChange = { url = it },
                label = { Text("웹훅 URL (https://script.google.com/macros/s/.../exec)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = secret,
                onValueChange = { secret = it },
                label = { Text("비밀키 (Apps Script 의 SECRET 속성과 동일하게)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = {
                    clipboard.setText(AnnotatedString(secret))
                    scope.launch { snackbar.showSnackbar("비밀키를 복사했습니다") }
                }) { Text("비밀키 복사") }
                TextButton(onClick = { secret = SettingsStore.generateSecret() }) { Text("새로 생성") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    save()
                    scope.launch { snackbar.showSnackbar("저장했습니다") }
                }) { Text("저장") }
                OutlinedButton(
                    enabled = !testing && url.startsWith("https://") && secret.isNotBlank(),
                    onClick = {
                        testing = true
                        scope.launch {
                            val result = withContext(Dispatchers.IO) {
                                WebhookClient(url.trim(), secret.trim()).send(Payload.test(secret.trim()))
                            }
                            testing = false
                            snackbar.showSnackbar(
                                result.fold(
                                    onSuccess = { "테스트 성공: ${it.take(80)}" },
                                    onFailure = { "테스트 실패: ${it.message}" }
                                )
                            )
                        }
                    }
                ) { Text(if (testing) "전송 중…" else "테스트 전송") }
            }

            Spacer(Modifier.padding(4.dp))
            Text("수집 대상", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = packages,
                onValueChange = { packages = it },
                label = { Text("패키지명 (쉼표로 구분)") },
                supportingText = { Text("카카오뱅크 기본값: ${SettingsStore.KAKAOBANK_PACKAGE}") },
                modifier = Modifier.fillMaxWidth()
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(checked = captureAll, onCheckedChange = { captureAll = it })
                Spacer(Modifier.width(8.dp))
                Column {
                    Text("모든 앱 알림 수집 (디버그)")
                    Text(
                        "패키지명을 확인할 때만 잠시 켜세요. 다른 앱의 개인정보도 저장됩니다.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
            Button(onClick = {
                save()
                scope.launch { snackbar.showSnackbar("저장했습니다") }
            }) { Text("저장") }

            Spacer(Modifier.padding(4.dp))
            Text("보안 안내", style = MaterialTheme.typography.titleMedium)
            Text(
                "• 알림 내용에는 금액·상대방 이름 등 금융 정보가 포함됩니다.\n" +
                    "• 웹훅은 HTTPS 만 허용되며, 비밀키가 본문에 함께 전송됩니다.\n" +
                    "• 웹훅을 끄면 데이터는 이 기기 밖으로 나가지 않습니다.",
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}
