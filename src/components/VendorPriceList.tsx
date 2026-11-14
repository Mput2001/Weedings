import { useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CalendarPlus,
  CheckCircle2,
  CreditCard,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  DigitalDocument,
  PaymentStatus,
  VENDOR_CATEGORIES,
  VendorCategory,
  VendorItem,
} from '../types';
import {
  formatDateID,
  formatIDR,
  getVendorRemaining,
  getVendorStatus,
} from '../utils/formatters';

interface VendorPriceListProps {
  vendors: VendorItem[];
  documents: DigitalDocument[];
  isGoogleConnected: boolean;
  syncingVendorId: string | null;
  onAddVendor: () => void;
  onEditVendor: (vendor: VendorItem) => void;
  onDeleteVendor: (vendor: VendorItem) => void;
  onRecordPayment: (vendorId: string) => void;
  onMarkPaidFull: (vendor: VendorItem) => void;
  onUploadDocumentForVendor: (vendorId: string) => void;
  onSyncVendorToCalendar: (vendor: VendorItem) => void;
}

type StatusFilter = 'Semua' | 'Belum Lunas' | 'Terlambat' | 'Lunas';

export function VendorPriceList({
  vendors,
  documents,
  isGoogleConnected,
  syncingVendorId,
  onAddVendor,
  onEditVendor,
  onDeleteVendor,
  onRecordPayment,
  onMarkPaidFull,
  onUploadDocumentForVendor,
  onSyncVendorToCalendar,
}: VendorPriceListProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Semua' | VendorCategory>('Semua');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Semua');

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.picName.toLowerCase().includes(q) ||
        v.serviceDescription.toLowerCase().includes(q);

      const matchesCategory = categoryFilter === 'Semua' || v.category === categoryFilter;
      const status = getVendorStatus(v);
      const matchesStatus =
        statusFilter === 'Semua' ||
        (statusFilter === 'Lunas' && status === 'Lunas') ||
        (statusFilter === 'Terlambat' && status === 'Terlambat') ||
        (statusFilter === 'Belum Lunas' && status !== 'Lunas');

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [vendors, search, categoryFilter, statusFilter]);

  const totals = useMemo(() => {
    return filteredVendors.reduce(
      (acc, v) => {
        const effective = v.contractPrice > 0 ? v.contractPrice : v.estimatedPrice;
        acc.estimated += v.estimatedPrice;
        acc.contracted += effective;
        acc.paid += v.paidAmount;
        acc.remaining += getVendorRemaining(v);
        return acc;
      },
      { estimated: 0, contracted: 0, paid: 0, remaining: 0 }
    );
  }, [filteredVendors]);

  const renderStatusText = (status: PaymentStatus) => {
    if (status === 'Lunas') {
      return <span className="font-semibold text-emerald-700">Lunas</span>;
    }
    if (status === 'Terlambat') {
      return <span className="font-semibold text-red-700">Terlambat</span>;
    }
    if (status === 'Cicilan' || status === 'DP Terbayar') {
      return <span className="font-semibold text-amber-700">{status}</span>;
    }
    return <span className="font-medium text-slate-600">Belum Bayar</span>;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      {/* Toolbar */}
      <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari vendor, PIC, layanan..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'Semua' | VendorCategory)}
            aria-label="Filter kategori vendor"
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
          >
            <option value="Semua">Semua Kategori</option>
            {VENDOR_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['Semua', 'Belum Lunas', 'Terlambat', 'Lunas'] as StatusFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onAddVendor}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tambah Vendor
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {filteredVendors.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <p className="text-sm font-medium text-slate-700">
              Tidak ada vendor yang cocok dengan filter pencarian.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Tambahkan vendor baru atau ubah kata kunci pencarian untuk melihat rincian harga.
            </p>
            <button
              type="button"
              onClick={onAddVendor}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-700 text-white rounded-lg hover:bg-teal-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Vendor & Harga
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 pl-5 pr-3">Vendor & Layanan</th>
                <th className="py-3 px-3">Jadwal & Jatuh Tempo</th>
                <th className="py-3 px-3 text-right">Harga Kontrak</th>
                <th className="py-3 px-3 text-right">Terbayar</th>
                <th className="py-3 px-3 text-right">Sisa Tagihan</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 pr-5 pl-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredVendors.map((v) => {
                const effectivePrice = v.contractPrice > 0 ? v.contractPrice : v.estimatedPrice;
                const remaining = getVendorRemaining(v);
                const status = getVendorStatus(v);
                const docCount = documents.filter((d) => d.vendorId === v.id).length;

                return (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 pl-5 pr-3 align-top">
                      <div className="font-semibold text-slate-900">{v.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {v.category} · PIC {v.picName} ({v.picPhone})
                      </div>
                      {v.serviceDescription && (
                        <div className="mt-1 text-xs text-slate-600 max-w-md">
                          {v.serviceDescription}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 align-top text-xs whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        Tempo: <span className="font-mono tabular-nums">{formatDateID(v.dueDate)}</span>
                      </div>
                      {v.eventDate && (
                        <div className="mt-1 text-slate-500">
                          {v.eventLabel}: <span className="font-mono tabular-nums">{formatDateID(v.eventDate)}</span>
                        </div>
                      )}
                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => onSyncVendorToCalendar(v)}
                          disabled={syncingVendorId === v.id}
                          title={
                            isGoogleConnected
                              ? 'Sinkronkan jadwal vendor ini ke Google Calendar'
                              : 'Masuk dengan Google di tab Kalender untuk sinkronisasi otomatis'
                          }
                          className={`inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer ${
                            v.calendarEventId
                              ? 'text-teal-700 hover:text-teal-800'
                              : 'text-slate-500 hover:text-teal-700'
                          }`}
                        >
                          {v.calendarEventId ? (
                            <>
                              <CalendarCheck2 className="w-3.5 h-3.5" />
                              {syncingVendorId === v.id ? 'Menyinkron...' : 'Tersinkron Google Calendar'}
                            </>
                          ) : (
                            <>
                              <CalendarPlus className="w-3.5 h-3.5" />
                              {syncingVendorId === v.id ? 'Menyinkron...' : 'Sinkron ke Kalender'}
                            </>
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{formatIDR(effectivePrice)}</div>
                      {v.estimatedPrice !== effectivePrice && (
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          Est. {formatIDR(v.estimatedPrice)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums text-teal-700 font-medium whitespace-nowrap">
                      {formatIDR(v.paidAmount)}
                    </td>

                    <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatIDR(remaining)}
                    </td>

                    <td className="py-3.5 px-3 align-top text-xs whitespace-nowrap">
                      {renderStatusText(status)}
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => onUploadDocumentForVendor(v.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-teal-700 cursor-pointer"
                        >
                          <FileText className="w-3 h-3" /> {docCount} dokumen
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 pr-5 pl-3 align-top text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {remaining > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => onMarkPaidFull(v)}
                              title="Tandai lunas penuh dan masukkan ke Total Uang Keluar"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Lunas
                            </button>
                            <button
                              type="button"
                              onClick={() => onRecordPayment(v.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-teal-700 text-white rounded-md hover:bg-teal-800 cursor-pointer"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Bayar
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onEditVendor(v)}
                          aria-label={`Ubah ${v.name}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteVendor(v)}
                          aria-label={`Hapus ${v.name}`}
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-900">
                <td className="py-3 pl-5 pr-3" colSpan={2}>
                  Total ({filteredVendors.length} Vendor Ditampilkan)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  {formatIDR(totals.contracted)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-teal-700">
                  {formatIDR(totals.paid)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700">
                  {formatIDR(totals.remaining)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
