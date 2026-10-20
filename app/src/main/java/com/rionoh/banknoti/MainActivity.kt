package com.rionoh.banknoti

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.recyclerview.widget.DividerItemDecoration
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private val io = Executors.newSingleThreadExecutor()
    private val adapter = RecordAdapter()
    private val onDbChanged: () -> Unit = { reload() }

    private lateinit var permStatus: TextView
    private lateinit var btnPermission: Button
    private lateinit var summary: TextView
    private lateinit var empty: TextView

    private val exportLauncher =
        registerForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
            if (uri != null) export(uri)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        findViewById<View>(R.id.root).applySystemBarPadding()

        permStatus = findViewById(R.id.permStatus)
        btnPermission = findViewById(R.id.btnPermission)
        summary = findViewById(R.id.summary)
        empty = findViewById(R.id.empty)

        findViewById<RecyclerView>(R.id.list).apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            addItemDecoration(DividerItemDecoration(this@MainActivity, DividerItemDecoration.VERTICAL))
            adapter = this@MainActivity.adapter
        }

        btnPermission.setOnClickListener { openListenerSettings() }
        findViewById<Button>(R.id.btnSettings).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        findViewById<Button>(R.id.btnExport).setOnClickListener {
            val stamp = SimpleDateFormat("yyyyMMdd_HHmm", Locale.KOREA).format(Date())
            exportLauncher.launch("bank_notifications_$stamp.csv")
        }
    }

    override fun onStart() {
        super.onStart()
        RecordDb.listeners.add(onDbChanged)
        reload()
    }

    override fun onResume() {
        super.onResume()
        val granted = NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)
        permStatus.setText(if (granted) R.string.perm_on else R.string.perm_off)
        btnPermission.visibility = if (granted) View.GONE else View.VISIBLE
    }

    override fun onStop() {
        RecordDb.listeners.remove(onDbChanged)
        super.onStop()
    }

    override fun onDestroy() {
        io.shutdown()
        super.onDestroy()
    }

    private fun reload() {
        io.execute {
            val db = RecordDb.get(this)
            val list = db.all(limit = DISPLAY_LIMIT)
            val total = db.count()
            runOnUiThread {
                if (isDestroyed) return@runOnUiThread
                adapter.submit(list)
                empty.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
                summary.text = "대상 앱: ${Prefs(this).targetPackages.joinToString(", ")}\n" +
                    "누적 ${total}건" + if (total > DISPLAY_LIMIT) " (최근 ${DISPLAY_LIMIT}건 표시)" else ""
            }
        }
    }

    private fun export(uri: Uri) {
        io.execute {
            val result = runCatching {
                val records = RecordDb.get(this).all()
                contentResolver.openOutputStream(uri)!!.use { CsvExporter.write(records, it) }
                records.size
            }
            runOnUiThread {
                val msg = result.fold(
                    onSuccess = { getString(R.string.export_done, it) },
                    onFailure = { getString(R.string.export_failed, it.message ?: it.javaClass.simpleName) },
                )
                Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun openListenerSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        runCatching { startActivity(intent) }
            .onFailure { startActivity(Intent(Settings.ACTION_SETTINGS)) }
    }

    companion object {
        private const val DISPLAY_LIMIT = 500
    }
}
