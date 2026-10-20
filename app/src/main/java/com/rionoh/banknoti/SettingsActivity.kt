package com.rionoh.banknoti

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.android.material.materialswitch.MaterialSwitch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class SettingsActivity : AppCompatActivity() {

    private val io = Executors.newSingleThreadExecutor()
    private lateinit var prefs: Prefs
    private lateinit var targets: EditText
    private lateinit var recentList: LinearLayout

    private val notifPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) postTestNotification()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        findViewById<View>(R.id.root).applySystemBarPadding()
        prefs = Prefs(this)

        targets = findViewById(R.id.targets)
        recentList = findViewById(R.id.recentList)
        targets.setText(prefs.targetPackages.sorted().joinToString("\n"))

        findViewById<Button>(R.id.btnSave).setOnClickListener {
            saveTargets()
            Toast.makeText(this, R.string.saved, Toast.LENGTH_SHORT).show()
        }

        findViewById<MaterialSwitch>(R.id.testMode).apply {
            isChecked = prefs.testMode
            setOnCheckedChangeListener { _, checked -> prefs.testMode = checked }
        }

        findViewById<Button>(R.id.btnTest).setOnClickListener { sendTest() }
        findViewById<Button>(R.id.btnClear).setOnClickListener { confirmClear() }
    }

    override fun onResume() {
        super.onResume()
        renderRecent()
    }

    override fun onDestroy() {
        io.shutdown()
        super.onDestroy()
    }

    private fun saveTargets() {
        prefs.targetPackages = targets.text.lines().map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    }

    private fun renderRecent() {
        recentList.removeAllViews()
        val fmt = SimpleDateFormat("MM/dd HH:mm", Locale.KOREA)
        val recent = prefs.recentPackages()
        if (recent.isEmpty()) {
            recentList.addView(TextView(this).apply { text = "아직 감지된 앱이 없습니다. (알림 접근 권한 허용 후 표시)" })
            return
        }
        recent.forEach { (pkg, time) ->
            val label = runCatching {
                packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
            }.getOrDefault("(이름 확인 불가)")
            recentList.addView(TextView(this).apply {
                text = "$label\n$pkg · ${fmt.format(Date(time))}"
                setPadding(0, 12, 0, 12)
                setOnClickListener { addTarget(pkg) }
            })
        }
    }

    private fun addTarget(pkg: String) {
        val current = targets.text.lines().map { it.trim() }.filter { it.isNotEmpty() }.toMutableSet()
        if (current.add(pkg)) {
            targets.setText(current.sorted().joinToString("\n"))
            saveTargets()
            Toast.makeText(this, "추가됨: $pkg", Toast.LENGTH_SHORT).show()
        }
    }

    private fun sendTest() {
        if (!prefs.testMode) {
            Toast.makeText(this, "먼저 테스트 모드를 켜 주세요.", Toast.LENGTH_SHORT).show()
            return
        }
        if (hasNotificationPermission()) {
            postTestNotification()
        } else {
            notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun hasNotificationPermission(): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    private fun postTestNotification() {
        if (!hasNotificationPermission()) return
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(TEST_CHANNEL, getString(R.string.test_channel), NotificationManager.IMPORTANCE_DEFAULT)
        )
        // 실제 카카오뱅크 문구가 아닌, 파이프라인 동작 확인용 임의 문구.
        val notification = NotificationCompat.Builder(this, TEST_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("[테스트] 입금 12,345원")
            .setContentText("테스트 입금 알림입니다. 잔액 1,012,345원")
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(this).notify((System.currentTimeMillis() % 100000).toInt(), notification)
        } catch (e: SecurityException) {
            return
        }
        Toast.makeText(this, "테스트 알림을 보냈습니다. 메인 화면에서 기록을 확인하세요.", Toast.LENGTH_LONG).show()
    }

    private fun confirmClear() {
        AlertDialog.Builder(this)
            .setMessage(R.string.clear_confirm)
            .setPositiveButton(R.string.delete) { _, _ -> io.execute { RecordDb.get(this).clear() } }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    companion object {
        private const val TEST_CHANNEL = "test"
    }
}
