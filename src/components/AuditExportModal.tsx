import { FileSpreadsheet, FileText, X } from 'lucide-react';
import { WeddingAppState } from '../types';
import { formatDateID, formatIDR, getVendorRemaining } from '../utils/formatters';

interface AuditExportModalProps {
  isOpen: boolean;
  state: WeddingAppState;
  onClose: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
}

export function AuditExportModal({
  isOpen,
  state,
  onClose,
  onExportPDF,
  onExportExcel,
}: AuditExportModalProps) {
  if (!isOpen) return null;

  const { config, vendors, payments, documents, items = [] } = state;
  const totalVendorPaid = vendors.reduce((s, v) => s + v.paidAmount, 0);
  const totalItemsPaid = items
    .filter((it) => it.purchased)
    .reduce((s, it) => s + it.price * (it.quantity || 1), 0);
  const totalUangKeluar = totalVendorPaid + totalItemsPaid;
  const lunasVendorsCount = vendors.filter((v) => getVendorRemaining(v) === 0).length;
  const purchasedItemsCount = items.filter((it) => it.purchased).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Ekspor Laporan Audit Keuangan Internal
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Unduh rekapitulasi total uang keluar, vendor, daftar barang & link, log pembayaran, dan dokumen digital
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal ekspor"
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
            <div className="px-4 py-2.5 flex justify-between">
              <span className="text-slate-500">Pasangan & Hari-H</span>
              <span className="font-semibold text-slate-900">
                {config.coupleNames} · {formatDateID(config.weddingDate)}
              </span>
            </div>
            <div className="px-4 py-2.5 flex justify-between">
              <span className="text-slate-500">Total Uang Keluar</span>
              <span className="font-mono font-semibold text-teal-700 tabular-nums">
                {formatIDR(totalUangKeluar)}
              </span>
            </div>
            <div className="px-4 py-2.5 flex justify-between">
              <span className="text-slate-500">
                Uang Keluar Vendor ({lunasVendorsCount}/{vendors.length} Lunas · {payments.length} transaksi)
              </span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatIDR(totalVendorPaid)}
              </span>
            </div>
            <div className="px-4 py-2.5 flex justify-between">
              <span className="text-slate-500">
                Uang Keluar List Barang ({purchasedItemsCount}/{items.length} dibeli)
              </span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatIDR(totalItemsPaid)}
              </span>
            </div>
            <div className="px-4 py-2.5 flex justify-between">
              <span className="text-slate-500">Arsip Dokumen Digital</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {documents.length} berkas
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onExportPDF}
              className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl hover:border-teal-700 hover:bg-teal-50/30 transition-colors text-left cursor-pointer"
            >
              <FileText className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-900">Unduh Laporan PDF</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Format siap cetak A4 berisi ringkasan eksekutif, tabel vendor, log kas & daftar dokumen.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={onExportExcel}
              className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl hover:border-teal-700 hover:bg-teal-50/30 transition-colors text-left cursor-pointer"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-900">Unduh Workbook Excel</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  File .xlsx 4 sheet (Ringkasan, Vendor & Harga, Transaksi, Arsip Dokumen) untuk audit.
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
