import { ArrowUpRight, AlertTriangle, CheckCircle2, FileText, Plus } from 'lucide-react';
import {
  BillAlert,
  DigitalDocument,
  PaymentRecord,
  ShoppingItem,
  VENDOR_CATEGORIES,
  VendorItem,
  WeddingConfig,
} from '../types';
import {
  formatCompactIDR,
  formatDateID,
  formatIDR,
  getVendorRemaining,
  getVendorStatus,
} from '../utils/formatters';

interface FinancialDashboardProps {
  config: WeddingConfig;
  vendors: VendorItem[];
  payments: PaymentRecord[];
  documents: DigitalDocument[];
  items: ShoppingItem[];
  alerts: BillAlert[];
  onRecordPayment: (vendorId?: string) => void;
  onAddVendor: () => void;
  onNavigateTab: (tab: 'vendors' | 'items' | 'calendar' | 'documents' | 'notifications') => void;
}

export function FinancialDashboard({
  config,
  vendors,
  payments,
  documents,
  items,
  alerts,
  onRecordPayment,
  onAddVendor,
  onNavigateTab,
}: FinancialDashboardProps) {
  const totalVendorPaid = vendors.reduce((sum, v) => sum + v.paidAmount, 0);
  const totalItemsCost = items.reduce((sum, it) => sum + it.price * (it.quantity || 1), 0);
  const totalItemsPaid = items
    .filter((it) => it.purchased)
    .reduce((sum, it) => sum + it.price * (it.quantity || 1), 0);

  const totalUangKeluar = totalVendorPaid + totalItemsPaid;
  const lunasVendorsCount = vendors.filter((v) => getVendorStatus(v) === 'Lunas').length;
  const purchasedItemsCount = items.filter((it) => it.purchased).length;

  // Category aggregation (Vendors + Shopping Items)
  const categoryStats = VENDOR_CATEGORIES.map((cat) => {
    const catVendors = vendors.filter((v) => v.category === cat);
    const catItems = items.filter((it) => it.category === cat);
    const totalPrice =
      catVendors.reduce(
        (s, v) => s + (v.contractPrice > 0 ? v.contractPrice : v.estimatedPrice),
        0
      ) + catItems.reduce((s, it) => s + it.price * (it.quantity || 1), 0);
    const paid =
      catVendors.reduce((s, v) => s + v.paidAmount, 0) +
      catItems
        .filter((it) => it.purchased)
        .reduce((s, it) => s + it.price * (it.quantity || 1), 0);
    return {
      category: cat,
      entryCount: catVendors.length + catItems.length,
      totalPrice,
      paid,
    };
  }).filter((item) => item.totalPrice > 0 || item.paid > 0);

  const maxCategoryValue = Math.max(...categoryStats.map((c) => c.totalPrice), 1);

  // Monthly cashflow schedule (upcoming unpaid bills grouped by YYYY-MM)
  const monthlyMap = new Map<string, { monthKey: string; label: string; dueAmount: number; paidAmount: number }>();
  const ensureMonth = (dateStr: string) => {
    if (!dateStr) return null;
    const key = dateStr.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) return null;
    if (!monthlyMap.has(key)) {
      const [yr, mo] = key.split('-').map(Number);
      const label = new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(
        new Date(yr, mo - 1, 1)
      );
      monthlyMap.set(key, { monthKey: key, label, dueAmount: 0, paidAmount: 0 });
    }
    return monthlyMap.get(key)!;
  };

  for (const p of payments) {
    const entry = ensureMonth(p.paymentDate);
    if (entry) entry.paidAmount += p.amount;
  }
  for (const v of vendors) {
    const rem = getVendorRemaining(v);
    if (rem > 0 && v.dueDate) {
      const entry = ensureMonth(v.dueDate);
      if (entry) entry.dueAmount += rem;
    }
  }

  const cashflowSeries = Array.from(monthlyMap.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );
  const maxMonthlyVal = Math.max(
    ...cashflowSeries.map((m) => Math.max(m.paidAmount, m.dueAmount)),
    1
  );

  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  return (
    <div className="space-y-6">
      {/* Total Uang Keluar Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Uang Keluar</div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-teal-700 tabular-nums">
            {formatIDR(totalUangKeluar)}
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {lunasVendorsCount} vendor lunas · {purchasedItemsCount} barang sudah dibeli
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Uang Keluar — Vendor</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatIDR(totalVendorPaid)}
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {lunasVendorsCount} dari {vendors.length} vendor lunas · {payments.length} transaksi
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Uang Keluar — List Barang</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatIDR(totalItemsPaid)}
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {purchasedItemsCount} dari {items.length} barang sudah dibeli
          </div>
        </div>
      </div>

      {/* Category Breakdown & Cashflow Projection */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Category Progress Chart */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Uang Keluar per Kategori
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Otomatis bertambah saat vendor dilunasi/dibayar atau barang ditandai sudah dibeli
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('vendors')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Kelola Vendor <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {categoryStats.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Belum ada pengeluaran atau item tercatat.
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={onAddVendor}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-teal-700 text-white rounded-lg hover:bg-teal-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Vendor Pertama
                  </button>
                </div>
              </div>
            ) : (
              categoryStats.map((item) => {
                const refMax = Math.max(item.totalPrice, maxCategoryValue * 0.25);
                const totalPct = Math.min(100, (item.totalPrice / refMax) * 100);
                const paidPct = Math.min(100, (item.paid / refMax) * 100);

                return (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <div className="font-medium text-slate-800">
                        {item.category}{' '}
                        <span className="text-slate-400 font-normal">
                          · {item.entryCount} item
                        </span>
                      </div>
                      <div className="font-mono text-slate-700 tabular-nums">
                        <span className="text-teal-700 font-semibold">{formatCompactIDR(item.paid)}</span>
                        <span className="text-slate-400"> / </span>
                        <span>{formatCompactIDR(item.totalPrice)}</span>
                      </div>
                    </div>

                    <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-slate-200 rounded-full transition-all duration-300"
                        style={{ width: `${totalPct}%` }}
                        title={`Total Daftar Harga: ${formatIDR(item.totalPrice)}`}
                      />
                      <div
                        className="absolute inset-y-0 left-0 bg-teal-700 rounded-full transition-all duration-300"
                        style={{ width: `${paidPct}%` }}
                        title={`Uang Keluar: ${formatIDR(item.paid)}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-2 rounded-sm bg-teal-700 inline-block" /> Uang Keluar (Lunas / Terbeli)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-2 rounded-sm bg-slate-200 inline-block" /> Total Daftar Harga
            </span>
          </div>
        </div>

        {/* Monthly Cashflow & Upcoming Obligations */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Arus Kas & Jadwal Kewajiban
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Realisasi keluar vs tagihan jatuh tempo per bulan
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRecordPayment()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                + Catat Bayar
              </button>
            </div>

            {cashflowSeries.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Belum ada riwayat atau jadwal jatuh tempo bulanan.
              </div>
            ) : (
              <div className="mt-6">
                <div className="grid grid-cols-1 gap-3">
                  {cashflowSeries.map((m) => {
                    const paidW = Math.round((m.paidAmount / maxMonthlyVal) * 100);
                    const dueW = Math.round((m.dueAmount / maxMonthlyVal) * 100);
                    return (
                      <div key={m.monthKey} className="grid grid-cols-12 items-center gap-3 text-xs">
                        <div className="col-span-3 font-medium text-slate-700">{m.label}</div>
                        <div className="col-span-5 space-y-1">
                          {m.paidAmount > 0 && (
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-700 rounded-full"
                                style={{ width: `${Math.max(4, paidW)}%` }}
                              />
                            </div>
                          )}
                          {m.dueAmount > 0 && (
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.max(4, dueW)}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="col-span-4 text-right font-mono tabular-nums">
                          {m.paidAmount > 0 && (
                            <div className="text-teal-700 font-medium">
                              +{formatCompactIDR(m.paidAmount)}
                            </div>
                          )}
                          {m.dueAmount > 0 && (
                            <div className="text-amber-700 font-medium">
                              Jatuh Tempo {formatCompactIDR(m.dueAmount)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              List barang: <strong className="font-mono text-slate-800">{formatCompactIDR(totalItemsCost)}</strong> ({items.length} item) · {documents.length} berkas
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('items')}
              className="text-teal-700 font-medium hover:underline cursor-pointer"
            >
              Buka List Barang & Link
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Split: Real-time Urgent Bills + Recent Payment Audit Ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Pengingat Tagihan Mendesak
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Dipantau otomatis dalam jendela H-{config.reminderLeadDays} hari
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('notifications')}
              className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Pusat Pengingat ({alerts.length})
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {alerts.length === 0 ? (
              <div className="py-8 flex flex-col items-center text-center text-sm text-slate-500">
                <CheckCircle2 className="w-6 h-6 text-teal-700 mb-2" />
                Tidak ada tagihan mendesak atau terlambat saat ini.
              </div>
            ) : (
              alerts.slice(0, 4).map((alert) => {
                const isOverdue = alert.severity === 'overdue';
                const isToday = alert.severity === 'due_today';
                return (
                  <div key={alert.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <AlertTriangle
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isOverdue
                              ? 'text-red-600'
                              : isToday
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          }`}
                        />
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {alert.vendorName}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        <span
                          className={`font-semibold ${
                            isOverdue
                              ? 'text-red-700'
                              : isToday
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {isOverdue
                            ? `Terlambat ${Math.abs(alert.daysDelta)} hari`
                            : isToday
                            ? 'Jatuh Tempo Hari Ini'
                            : `H-${alert.daysDelta} (${formatDateID(alert.dueDate)})`}
                        </span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          {formatIDR(alert.remainingAmount)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRecordPayment(alert.vendorId)}
                      className="px-3 py-1.5 text-xs font-medium bg-teal-700 text-white rounded-lg hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Bayar
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Ledger Pembayaran Terbaru
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Rekam jejak dana keluar beserta tautan bukti transfer digital
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRecordPayment()}
              className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              + Catat Transaksi
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            {payments.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Belum ada transaksi pembayaran tercatat.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 pr-3">Tanggal</th>
                    <th className="py-2.5 px-3">Vendor</th>
                    <th className="py-2.5 px-3">Tahap & Metode</th>
                    <th className="py-2.5 px-3 text-right">Nominal</th>
                    <th className="py-2.5 pl-3 text-right">Bukti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {payments.slice(0, 6).map((p) => {
                    const vendor = vendorMap.get(p.vendorId);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {formatDateID(p.paymentDate)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[180px] truncate">
                          {vendor?.name || 'Vendor'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {p.stage} · {p.method}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-teal-700 tabular-nums whitespace-nowrap">
                          {formatIDR(p.amount)}
                        </td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          {p.documentId ? (
                            <button
                              type="button"
                              onClick={() => onNavigateTab('documents')}
                              className="inline-flex items-center gap-1 text-teal-700 font-medium hover:underline cursor-pointer"
                            >
                              <FileText className="w-3 h-3" /> Terlampir
                            </button>
                          ) : (
                            <span className="text-slate-400">Belum ada</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
