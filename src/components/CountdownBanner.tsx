import { useEffect, useState } from 'react';
import { CalendarDays, Check, MapPin, Pencil, X } from 'lucide-react';
import { VendorItem, WeddingConfig } from '../types';
import { formatDateID, getVendorStatus } from '../utils/formatters';

interface CountdownBannerProps {
  config: WeddingConfig;
  vendors: VendorItem[];
  onQuickSaveNameAndSchedule: (updated: Partial<WeddingConfig>) => Promise<void>;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

function calculateTimeRemaining(targetIso: string): TimeRemaining {
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = target - now;

  if (Number.isNaN(target) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: diff <= 0 && !Number.isNaN(target) };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, isPast: false };
}

export function CountdownBanner({
  config,
  vendors,
  onQuickSaveNameAndSchedule,
}: CountdownBannerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(config.weddingDate)
  );
  const [inlineEditing, setInlineEditing] = useState(false);
  const [coupleNames, setCoupleNames] = useState(config.coupleNames);
  const [weddingDate, setWeddingDate] = useState(config.weddingDate.slice(0, 16));
  const [venueName, setVenueName] = useState(config.venueName);
  const [city, setCity] = useState(config.city);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCoupleNames(config.coupleNames);
    setWeddingDate(config.weddingDate.slice(0, 16));
    setVenueName(config.venueName);
    setCity(config.city);
  }, [config]);

  useEffect(() => {
    setTimeLeft(calculateTimeRemaining(config.weddingDate));
    const timer = window.setInterval(() => {
      setTimeLeft(calculateTimeRemaining(config.weddingDate));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [config.weddingDate]);

  const paidVendorsCount = vendors.filter((v) => getVendorStatus(v) === 'Lunas').length;
  const totalVendorsCount = vendors.length;
  const syncedCalendarCount = vendors.filter((v) => Boolean(v.calendarEventId)).length;

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupleNames.trim() || !weddingDate) return;
    setSaving(true);
    try {
      await onQuickSaveNameAndSchedule({
        coupleNames: coupleNames.trim(),
        weddingDate,
        venueName: venueName.trim(),
        city: city.trim(),
      });
      setInlineEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6">
      {inlineEditing ? (
        <form onSubmit={handleInlineSubmit} className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Edit Nama Pasangan & Jadwal Hari-H
            </h3>
            <button
              type="button"
              onClick={() => setInlineEditing(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Batal edit nama dan jadwal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nama Pasangan / Acara
              </label>
              <input
                type="text"
                required
                value={coupleNames}
                onChange={(e) => setCoupleNames(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tanggal & Jam Hari-H
              </label>
              <input
                type="datetime-local"
                required
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Lokasi / Venue
              </label>
              <input
                type="text"
                required
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Kota
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setInlineEditing(false)}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 cursor-pointer disabled:opacity-60"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Menyimpan...' : 'Simpan Nama & Jadwal'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5 text-teal-700 font-semibold">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDateID(config.weddingDate)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {config.venueName}, {config.city}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {paidVendorsCount}/{totalVendorsCount} Vendor Lunas
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {syncedCalendarCount} Tersinkron Kalender
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
                Pernikahan {config.coupleNames}
              </h2>
              <button
                type="button"
                onClick={() => setInlineEditing(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 hover:text-teal-800 hover:bg-teal-50 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Pencil className="w-3 h-3" />
                Edit Nama & Jadwal
              </button>
            </div>
          </div>

          <div className="shrink-0">
            {timeLeft.isPast ? (
              <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-semibold text-emerald-800">
                Hari-H Pernikahan Telah Tiba / Berlalu
              </div>
            ) : (
              <div
                className="grid grid-cols-4 divide-x divide-slate-200 border border-slate-200 rounded-lg bg-slate-50/70"
                aria-label="Hitungan mundur menuju hari pernikahan"
              >
                {[
                  { label: 'Hari', value: String(timeLeft.days).padStart(2, '0') },
                  { label: 'Jam', value: String(timeLeft.hours).padStart(2, '0') },
                  { label: 'Menit', value: String(timeLeft.minutes).padStart(2, '0') },
                  { label: 'Detik', value: String(timeLeft.seconds).padStart(2, '0') },
                ].map((unit) => (
                  <div key={unit.label} className="px-3.5 sm:px-5 py-2.5 text-center min-w-[70px]">
                    <div className="font-mono text-xl sm:text-2xl font-semibold text-slate-900 tabular-nums leading-none">
                      {unit.value}
                    </div>
                    <div className="mt-1.5 text-[11px] font-medium text-slate-500">
                      {unit.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
