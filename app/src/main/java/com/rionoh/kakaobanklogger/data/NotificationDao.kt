package com.rionoh.kakaobanklogger.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface NotificationDao {

    /** 중복(dedupeKey 충돌)이면 -1 을 반환한다. */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(record: NotificationRecord): Long

    @Query("SELECT * FROM notifications ORDER BY postedAt DESC, id DESC")
    fun observeAll(): Flow<List<NotificationRecord>>

    @Query("SELECT * FROM notifications ORDER BY postedAt ASC, id ASC")
    suspend fun getAllOldestFirst(): List<NotificationRecord>

    @Query("SELECT * FROM notifications WHERE id = :id")
    suspend fun getById(id: Long): NotificationRecord?

    /**
     * 미전송 레코드. 시도 횟수가 [maxAttempts] 이상인 레코드는
     * 무한 재시도를 막기 위해 제외한다(화면에서 수동 재전송 가능).
     */
    @Query(
        "SELECT * FROM notifications WHERE forwardedAt IS NULL AND forwardAttempts < :maxAttempts " +
            "ORDER BY postedAt ASC, id ASC LIMIT :limit"
    )
    suspend fun pendingForward(limit: Int, maxAttempts: Int): List<NotificationRecord>

    @Query("UPDATE notifications SET forwardedAt = :at, lastError = NULL WHERE id = :id")
    suspend fun markForwarded(id: Long, at: Long)

    @Query("UPDATE notifications SET forwardAttempts = forwardAttempts + 1, lastError = :error WHERE id = :id")
    suspend fun markFailed(id: Long, error: String?)

    @Query("UPDATE notifications SET forwardedAt = NULL, forwardAttempts = 0, lastError = NULL WHERE id = :id")
    suspend fun resetForward(id: Long)

    @Query("UPDATE notifications SET forwardedAt = NULL, forwardAttempts = 0, lastError = NULL WHERE forwardedAt IS NULL")
    suspend fun resetAllPending()

    @Query("SELECT COUNT(*) FROM notifications")
    fun observeCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM notifications WHERE forwardedAt IS NULL")
    fun observePendingCount(): Flow<Int>

    @Query("DELETE FROM notifications WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM notifications")
    suspend fun deleteAll()
}
