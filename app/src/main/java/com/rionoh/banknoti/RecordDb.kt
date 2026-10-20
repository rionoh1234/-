package com.rionoh.banknoti

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.os.Handler
import android.os.Looper
import java.util.concurrent.CopyOnWriteArraySet

class RecordDb private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "records.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                received_at INTEGER NOT NULL,
                post_time INTEGER NOT NULL,
                package TEXT NOT NULL,
                noti_key TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                sub_text TEXT NOT NULL,
                tx_type TEXT NOT NULL,
                amount INTEGER,
                balance INTEGER,
                UNIQUE(package, noti_key, post_time, title, body)
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX idx_records_post_time ON records(post_time DESC)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    /** 같은 알림(같은 키·게시시각·내용)이 다시 전달되면 무시한다. 새로 저장했으면 true. */
    fun insert(r: BankRecord): Boolean {
        val values = ContentValues().apply {
            put("received_at", r.receivedAt)
            put("post_time", r.postTime)
            put("package", r.packageName)
            put("noti_key", r.notificationKey)
            put("title", r.title)
            put("body", r.body)
            put("sub_text", r.subText)
            put("tx_type", r.type.name)
            if (r.amount != null) put("amount", r.amount) else putNull("amount")
            if (r.balance != null) put("balance", r.balance) else putNull("balance")
        }
        val id = writableDatabase.insertWithOnConflict(
            "records", null, values, SQLiteDatabase.CONFLICT_IGNORE
        )
        if (id != -1L) notifyChanged()
        return id != -1L
    }

    fun all(limit: Int? = null): List<BankRecord> {
        val sql = "SELECT * FROM records ORDER BY post_time DESC, id DESC" +
            (limit?.let { " LIMIT $it" } ?: "")
        return readableDatabase.rawQuery(sql, null).use { c ->
            buildList { while (c.moveToNext()) add(c.toRecord()) }
        }
    }

    fun count(): Int =
        readableDatabase.rawQuery("SELECT COUNT(*) FROM records", null).use { c ->
            if (c.moveToFirst()) c.getInt(0) else 0
        }

    fun clear() {
        writableDatabase.delete("records", null, null)
        notifyChanged()
    }

    private fun Cursor.toRecord() = BankRecord(
        id = getLong(getColumnIndexOrThrow("id")),
        receivedAt = getLong(getColumnIndexOrThrow("received_at")),
        postTime = getLong(getColumnIndexOrThrow("post_time")),
        packageName = getString(getColumnIndexOrThrow("package")),
        notificationKey = getString(getColumnIndexOrThrow("noti_key")),
        title = getString(getColumnIndexOrThrow("title")),
        body = getString(getColumnIndexOrThrow("body")),
        subText = getString(getColumnIndexOrThrow("sub_text")),
        type = NotificationParser.TxType.fromName(getString(getColumnIndexOrThrow("tx_type"))),
        amount = getColumnIndexOrThrow("amount").let { if (isNull(it)) null else getLong(it) },
        balance = getColumnIndexOrThrow("balance").let { if (isNull(it)) null else getLong(it) },
    )

    companion object {
        @Volatile private var instance: RecordDb? = null

        fun get(context: Context): RecordDb =
            instance ?: synchronized(this) { instance ?: RecordDb(context).also { instance = it } }

        /** 리스너 서비스와 화면이 같은 프로세스에서 돌므로 간단한 콜백으로 갱신을 알린다. */
        val listeners = CopyOnWriteArraySet<() -> Unit>()
        private val main = Handler(Looper.getMainLooper())

        private fun notifyChanged() = main.post { listeners.forEach { it() } }
    }
}
