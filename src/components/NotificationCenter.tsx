import { Bell, BellRing, CheckCircle2, Clock, CreditCard, Volume2, VolumeX } from 'lucide-react';
import { BillAlert, WeddingConfig } from '../types';
import { formatDateID, formatIDR } from '../utils/formatters';

interface NotificationCenterProps {
  alerts: BillAlert[];
  config: WeddingConfig;
  lastCheckedAt: Date;
  notificationPermission: NotificationPermission | 'unsupported';
  onRequestBrowserPermission: () => void;
  onToggleSound: (enabled: boolean) => void;
  onUpdateLeadDays: (days: number) => void;
  onRecordPayment: (vendorId: string) => void;
  onTestLiveAlert: () => void;
}

export function NotificationCenter({
  alerts,
  config,
  lastCheckedAt,
  notificationPermission,
  onRequestBrowserPermission,
  onToggleSound,
  onUpdateLeadDays,
  onRecordPayment,
  onTestLiveAlert,
}: NotificationCenterProps) {
  const overdueAlerts = alerts.filter((a) => a.severity === 'overdue');
  const todayAlerts = alerts.filter((a) => a.severity === 'due_today');
  const upcomingAlerts = alerts.filter((a) => a.severity === 'upcoming');

  const totalAlertAmount = alerts.reduce((s, a) => s + a.remainingAmount, 0);

  return (
    <div className="space-y-6">
      {/* Real-time Monitoring Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Pengingat Tagihan Vendor Real-Time
          </h3>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Pemindaian otomatis aktif · Terakhir diperiksa {lastCheckedAt.toLocaleTimeString('id-ID')} · Total kewajiban dalam jendela pengingat:{' '}
            <strong className="text-slate-900 font-mono">{formatIDR(totalAlertAmount)}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <span>Ingatkan mulai:</span>
            <select
              value={config.reminderLeadDays}
              onChange={(e) => onUpdateLeadDays(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium"
            >
              <option value={3}>H-3</option>
              <option value={7}>H-7</option>
              <option value={14}>H-14</option>
              <option value={30}>H-30</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => onToggleSound(!config.soundAlertsEnabled)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
          >
            {config.soundAlertsEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-teal-700" /> Suara Aktif
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" /> Suara Senyap
              </>
            )}
          </button>

          {notificationPermission !== 'unsupported' && notificationPermission !== 'granted' && (
            <button
              type="button"
              onClick={onRequestBrowserPermission}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" /> Aktifkan Notifikasi Browser
            </button>
          )}

          <button
            type="button"
            onClick={onTestLiveAlert}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" /> Uji Pengingat Sekarang
          </button>
        </div>
      </div>

      {/* Alert Groups */}
      {alerts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 px-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-teal-700 mx-auto mb-2" />
          <div className="text-sm font-semibold text-slate-900">
            Seluruh Tagihan Vendor Terkendali
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tidak ada pembayaran terlambat atau jatuh tempo dalam {config.reminderLeadDays} hari ke depan.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {[
            {
              title: 'Terlambat dari Jatuh Tempo',
              items: overdueAlerts,
              emptyHidden: true,
              accentText: 'text-red-700',
              borderStyle: 'border-red-200 bg-red-50/40',
            },
            {
              title: 'Jatuh Tempo Hari Ini',
              items: todayAlerts,
              emptyHidden: true,
              accentText: 'text-amber-700',
              borderStyle: 'border-amber-200 bg-amber-50/40',
            },
            {
              title: `Mendekati Jatuh Tempo (Dalam ${config.reminderLeadDays} Hari)`,
              items: upcomingAlerts,
              emptyHidden: true,
              accentText: 'text-slate-800',
              borderStyle: 'border-slate-200 bg-white',
            },
          ]
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <section
                key={group.title}
                className={`border rounded-xl overflow-hidden ${group.borderStyle}`}
              >
                <div className="px-5 py-3.5 border-b border-slate-200/70 flex items-center justify-between">
                  <h4 className={`text-sm font-semibold ${group.accentText}`}>
                    {group.title}
                  </h4>
                  <span className="text-xs font-mono text-slate-600 tabular-nums">
                    {group.items.length} tagihan
                  </span>
                </div>

                <div className="divide-y divide-slate-200/60 bg-white">
                  {group.items.map((alert) => (
                    <div
                      key={alert.id}
                      className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {alert.vendorName}
                          </span>
                          <span className="text-xs text-slate-500">
                            · {alert.category} · Kontak PIC: {alert.picPhone}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Jatuh tempo: <strong className="font-mono">{formatDateID(alert.dueDate)}</strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-semibold ${group.accentText}`}>
                            {alert.daysDelta < 0
                              ? `Terlambat ${Math.abs(alert.daysDelta)} hari`
                              : alert.daysDelta === 0
                              ? 'Harus dibayar hari ini'
                              : `Sisa waktu ${alert.daysDelta} hari`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-[11px] text-slate-500">Sisa Tagihan</div>
                          <div className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                            {formatIDR(alert.remainingAmount)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onRecordPayment(alert.vendorId)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Catat Pembayaran
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
