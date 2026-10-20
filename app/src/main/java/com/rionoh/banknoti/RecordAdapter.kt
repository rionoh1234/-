package com.rionoh.banknoti

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RecordAdapter : RecyclerView.Adapter<RecordAdapter.Holder>() {

    private var items: List<BankRecord> = emptyList()
    private val timeFmt = SimpleDateFormat("MM/dd HH:mm", Locale.KOREA)

    fun submit(list: List<BankRecord>) {
        items = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = Holder(
        LayoutInflater.from(parent.context).inflate(R.layout.item_record, parent, false)
    )

    override fun getItemCount() = items.size

    override fun onBindViewHolder(h: Holder, position: Int) {
        val r = items[position]
        h.type.text = r.type.label
        h.type.setTextColor(
            when (r.type) {
                NotificationParser.TxType.DEPOSIT -> 0xFF1565C0.toInt()
                NotificationParser.TxType.WITHDRAWAL, NotificationParser.TxType.PAYMENT -> 0xFFC62828.toInt()
                else -> 0xFF757575.toInt()
            }
        )
        h.amount.text = r.amount?.let { won(it) } ?: "금액 인식 안 됨"
        h.time.text = timeFmt.format(Date(r.postTime))
        h.balance.visibility = if (r.balance == null) View.GONE else View.VISIBLE
        h.balance.text = r.balance?.let { "잔액 ${won(it)}" }
        h.raw.text = listOf(r.title, r.body).filter { it.isNotBlank() }.joinToString(" · ")
    }

    class Holder(v: View) : RecyclerView.ViewHolder(v) {
        val type: TextView = v.findViewById(R.id.type)
        val amount: TextView = v.findViewById(R.id.amount)
        val time: TextView = v.findViewById(R.id.time)
        val balance: TextView = v.findViewById(R.id.balance)
        val raw: TextView = v.findViewById(R.id.raw)
    }

    companion object {
        fun won(v: Long): String = NumberFormat.getNumberInstance(Locale.KOREA).format(v) + "원"
    }
}
