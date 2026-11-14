import { useMemo, useState } from 'react';
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  LogOut,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { GoogleCalendarEventSummary } from '../services/googleWorkspace';
import { VendorItem, WeddingConfig } from '../types';
import { formatDateID, formatIDR, getVendorRemaining } from '../utils/formatters';

interface WeddingCalendarViewProps {
  config: WeddingConfig;
  vendors: VendorItem[];
  googleUser: User | null;
  isGoogleConnected: boolean;
  isLoggingIn: boolean;
  isBulkSyncing: boolean;
  googleEvents: GoogleCalendarEventSummary[];
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
  onSyncAllToGoogleCalendar: () => void;
  onSyncSingleVendor: (vendor: VendorItem) => void;
  onDeleteCalendarEvent: (vendor: VendorItem) => void;
  onRefreshGoogleEvents: () => void;
  onDownloadICS: () => void;
  onEditVendor: (vendor: VendorItem) => void;
  onEditWeddingConfig: () => void;
}

interface CalendarDayEvent {
  id: string;
  date: string;
  title: string;
  type: 'wedding' | 'due' | 'milestone';
  vendor?: VendorItem;
  amount?: number;
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function WeddingCalendarView({
  config,
  vendors,
  googleUser,
  isGoogleConnected,
  isLoggingIn,
  isBulkSyncing,
  googleEvents,
  onGoogleLogin,
  onGoogleLogout,
  onSyncAllToGoogleCalendar,
  onSyncSingleVendor,
  onDeleteCalendarEvent,
  onRefreshGoogleEvents,
  onDownloadICS,
  onEditVendor,
  onEditWeddingConfig,
}: WeddingCalendarViewProps) {
  const initialDate = new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(initialDate.toISOString().split('T')[0]);

  const allEvents = useMemo<CalendarDayEvent[]>(() => {
    const list: CalendarDayEvent[] = [];
    const weddingDateOnly = config.weddingDate.split('T')[0];
    list.push({
      id: 'wedding-day',
      date: weddingDateOnly,
      title: `Hari Pernikahan: ${config.coupleNames}`,
      type: 'wedding',
    });

    for (const v of vendors) {
      const remaining = getVendorRemaining(v);
      if (v.dueDate) {
        list.push({
          id: `due-${v.id}`,
          date: v.dueDate,
          title:
            remaining > 0
              ? `Jatuh Tempo: ${v.name} (${formatIDR(remaining)})`
              : `Tagihan Lunas: ${v.name}`,
          type: 'due',
          vendor: v,
          amount: remaining,
        });
      }
      if (v.eventDate) {
        list.push({
          id: `ev-${v.id}`,
          date: v.eventDate,
          title: `${v.eventLabel || 'Jadwal'}: ${v.name}`,
          type: 'milestone',
          vendor: v,
        });
      }
    }

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [config, vendors]);

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: { dateStr: string | null; dayNum: number | null }[] = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ dateStr: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({ dateStr: `${viewYear}-${mStr}-${dStr}`, dayNum: d });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarDayEvent[]>();
    for (const ev of allEvents) {
      const existing = map.get(ev.date) || [];
      existing.push(ev);
      map.set(ev.date, existing);
    }
    return map;
  }, [allEvents]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectedDayEvents = eventsByDate.get(selectedDate) || [];

  return (
    <div className="space-y-6">
      {/* Sync Control Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Sinkronisasi Google Calendar & Ekspor Jadwal (.ics)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Hubungkan akun Google untuk mengirim seluruh jadwal jatuh tempo pembayaran vendor dan agenda acara langsung ke Google Calendar Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onDownloadICS}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Unduh Kalender (.ics)
          </button>

          {!isGoogleConnected ? (
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-600">
                Terhubung: <strong className="text-slate-900">{googleUser?.email}</strong>
              </span>
              <button
                type="button"
                onClick={onSyncAllToGoogleCalendar}
                disabled={isBulkSyncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBulkSyncing ? 'animate-spin' : ''}`} />
                {isBulkSyncing ? 'Menyinkronkan...' : 'Sinkron Semua ke Google Calendar'}
              </button>
              <button
                type="button"
                onClick={onGoogleLogout}
                title="Putuskan sesi Google"
                className="p-2 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Calendar Grid + Selected Day & Google Calendar Agenda */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-slate-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h4>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Bulan sebelumnya"
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setViewYear(now.getFullYear());
                  setViewMonth(now.getMonth());
                  setSelectedDate(now.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Bulan berikutnya"
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-t border-l border-slate-200 rounded-lg overflow-hidden">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[11px] font-semibold text-slate-500 bg-slate-50 border-r border-b border-slate-200"
              >
                {day}
              </div>
            ))}

            {calendarCells.map((cell, idx) => {
              if (!cell.dateStr || !cell.dayNum) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[86px] bg-slate-50/40 border-r border-b border-slate-200"
                  />
                );
              }
              const dayEvents = eventsByDate.get(cell.dateStr) || [];
              const isSelected = cell.dateStr === selectedDate;
              const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr!)}
                  className={`min-h-[86px] p-1.5 text-left align-top border-r border-b border-slate-200 transition-colors flex flex-col cursor-pointer ${
                    isSelected ? 'bg-teal-50/60 ring-1 ring-inset ring-teal-700' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`font-mono text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-md ${
                      isToday ? 'bg-slate-900 text-white' : 'text-slate-700'
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  <div className="mt-1 space-y-1 w-full">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded truncate font-medium ${
                          ev.type === 'wedding'
                            ? 'bg-slate-900 text-white'
                            : ev.type === 'due'
                            ? ev.amount && ev.amount > 0
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900'
                            : 'bg-teal-100 text-teal-900'
                        }`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-slate-500 pl-1">
                        +{dayEvents.length - 2} lagi
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Selected Day + Google Calendar Live Events */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-slate-900">
              Agenda Tanggal {formatDateID(selectedDate)}
            </h4>
            <div className="mt-3 divide-y divide-slate-100">
              {selectedDayEvents.length === 0 ? (
                <p className="py-6 text-xs text-slate-500 text-center">
                  Tidak ada jatuh tempo tagihan atau agenda vendor pada tanggal ini.
                </p>
              ) : (
                selectedDayEvents.map((ev) => (
                  <div key={ev.id} className="py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-900">{ev.title}</div>
                      {ev.type === 'wedding' && (
                        <button
                          type="button"
                          onClick={onEditWeddingConfig}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:underline shrink-0 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" /> Edit Jadwal
                        </button>
                      )}
                    </div>
                    {ev.vendor && (
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>{ev.vendor.category}</span>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => onEditVendor(ev.vendor!)}
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onSyncSingleVendor(ev.vendor!)}
                            className="text-teal-700 font-medium hover:underline cursor-pointer"
                          >
                            {ev.vendor.calendarEventId ? 'Perbarui Google Cal' : 'Kirim ke Google Cal'}
                          </button>
                          {ev.vendor.calendarEventId && isGoogleConnected && (
                            <button
                              type="button"
                              onClick={() => onDeleteCalendarEvent(ev.vendor!)}
                              title="Hapus acara ini dari Google Calendar"
                              className="text-red-600 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900">
                Agenda Google Calendar Anda
              </h4>
              {isGoogleConnected && (
                <button
                  type="button"
                  onClick={onRefreshGoogleEvents}
                  className="text-xs font-medium text-teal-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Muat Ulang
                </button>
              )}
            </div>

            {!isGoogleConnected ? (
              <p className="py-6 text-xs text-slate-500">
                Masuk dengan akun Google di atas untuk melihat daftar acara aktif dari Google Calendar dan menyinkronkan pengingat pembayaran secara dua arah.
              </p>
            ) : googleEvents.length === 0 ? (
              <p className="py-6 text-xs text-slate-500">
                Belum ada acara mendatang di kalender utama Anda atau klik "Sinkron Semua" untuk mendorong jadwal tagihan vendor.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-slate-100 max-h-[260px] overflow-y-auto">
                {googleEvents.map((gEv) => (
                  <div key={gEv.id} className="py-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-800 truncate">
                        {gEv.summary}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {formatDateID(gEv.start)}
                      </div>
                    </div>
                    {gEv.htmlLink && (
                      <a
                        href={gEv.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-teal-700 shrink-0"
                        title="Buka di Google Calendar"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Chronological Timeline Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          Daftar Kronologis Seluruh Jadwal & Jatuh Tempo
        </h4>
        <div className="divide-y divide-slate-100">
          {allEvents.map((ev) => (
            <div key={ev.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono tabular-nums font-medium text-slate-600 w-28 shrink-0">
                  {formatDateID(ev.date)}
                </span>
                <span className="font-medium text-slate-900 truncate">{ev.title}</span>
              </div>
              {ev.vendor ? (
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditVendor(ev.vendor!)}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" /> Edit Jadwal
                  </button>
                  {ev.vendor.calendarEventId ? (
                    <span className="inline-flex items-center gap-1 text-teal-700 font-medium">
                      <CalendarCheck2 className="w-3.5 h-3.5" /> Tersinkron
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSyncSingleVendor(ev.vendor!)}
                      className="text-slate-600 hover:text-teal-700 font-medium cursor-pointer"
                    >
                      Sinkronkan
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onEditWeddingConfig}
                  className="inline-flex items-center gap-1 text-teal-700 font-medium hover:underline shrink-0 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" /> Edit Nama & Hari-H
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
