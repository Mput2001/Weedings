import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Download,
  FileArchive,
  LayoutDashboard,
  ListChecks,
  Menu,
  Plus,
  ShoppingBag,
  Upload,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { AuditExportModal } from './components/AuditExportModal';
import { CountdownBanner } from './components/CountdownBanner';
import { DocumentVault } from './components/DocumentVault';
import { FinancialDashboard } from './components/FinancialDashboard';
import {
  ConfirmModal,
  DocumentPreviewModal,
  PaymentModal,
  VendorModal,
  WeddingConfigModal,
} from './components/Modals';
import { NotificationCenter } from './components/NotificationCenter';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ShoppingItemList } from './components/ShoppingItemList';
import { VendorPriceList } from './components/VendorPriceList';
import { WeddingCalendarView } from './components/WeddingCalendarView';
import {
  deleteGoogleCalendarEvent,
  fetchUpcomingGoogleCalendarEvents,
  getWorkspaceAccessToken,
  GoogleCalendarEventSummary,
  googleWorkspaceLogout,
  googleWorkspaceSignIn,
  initWorkspaceAuth,
  syncVendorToGoogleCalendar,
} from './services/googleWorkspace';
import {
  addLocalItem,
  addLocalVendor,
  deleteLocalDocument,
  deleteLocalItem,
  deleteLocalVendor,
  downloadLocalDocument,
  loadLocalState,
  recordLocalPayment,
  restoreLocalState,
  updateLocalConfig,
  updateLocalItem,
  updateLocalVendor,
  updateLocalVendorCalendar,
  uploadLocalDocument,
} from './services/localWeddingStorage';
import {
  DigitalDocument,
  DocumentKind,
  PaymentRecord,
  ShoppingItem,
  VendorCategory,
  VendorItem,
  WeddingAppState,
  WeddingConfig,
} from './types';
import { exportAuditExcel, exportAuditPDF } from './utils/exportAudit';
import { computeBillAlerts, formatIDR, generateICS, getVendorRemaining } from './utils/formatters';

type ActiveTab = 'dashboard' | 'vendors' | 'items' | 'calendar' | 'documents' | 'notifications';

interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'warning' | 'error';
}

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => Promise<void>;
}

function playReminderChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  } catch {
    // Ignore autoplay restriction errors
  }
}

export default function App() {
  const [state, setState] = useState<WeddingAppState>(() => loadLocalState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentVendorId, setPaymentVendorId] = useState<string | undefined>(undefined);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DigitalDocument | null>(null);
  const [docVendorFilter, setDocVendorFilter] = useState<string>('Semua');

  // Confirmation modal state
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Google Calendar Auth & Sync states
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [syncingVendorId, setSyncingVendorId] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEventSummary[]>([]);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  // Real-time notification engine states
  const [lastCheckedAt, setLastCheckedAt] = useState<Date>(() => new Date());
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const alertedIdsRef = useRef<Set<string>>(new Set());

  const pushToast = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  }, []);

  // Initialize Firebase Google Calendar Auth listener
  useEffect(() => {
    const unsub = initWorkspaceAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setGoogleEvents([]);
      }
    );
    return () => unsub();
  }, []);

  const alerts = useMemo(() => {
    return computeBillAlerts(state.vendors, state.config.reminderLeadDays);
  }, [state]);

  const triggerRealtimeCheck = useCallback(
    (forceNotify = false) => {
      setLastCheckedAt(new Date());
      if (alerts.length === 0) return;

      const urgent = alerts.filter((a) => a.severity === 'overdue' || a.severity === 'due_today');
      const newUrgent = forceNotify
        ? alerts
        : urgent.filter((a) => !alertedIdsRef.current.has(a.id));

      if (newUrgent.length > 0) {
        for (const a of newUrgent) {
          alertedIdsRef.current.add(a.id);
        }
        if (state.config.soundAlertsEnabled) {
          playReminderChime();
        }
        const first = newUrgent[0];
        const summaryMsg =
          first.daysDelta < 0
            ? `Pengingat Tagihan Terlambat: ${first.vendorName} (${formatIDR(first.remainingAmount)})`
            : first.daysDelta === 0
            ? `Jatuh Tempo Hari Ini: ${first.vendorName} (${formatIDR(first.remainingAmount)})`
            : `Tagihan Mendekati Jatuh Tempo (H-${first.daysDelta}): ${first.vendorName}`;

        pushToast(
          newUrgent.length > 1
            ? `${summaryMsg} (+${newUrgent.length - 1} tagihan lainnya)`
            : summaryMsg,
          'warning'
        );

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification('Pengingat Tagihan Vendor — RencanaNikah', {
            body: summaryMsg,
          });
        }
      }
    },
    [alerts, pushToast, state.config.soundAlertsEnabled]
  );

  // Real-time background due-date scanner every 15 seconds
  useEffect(() => {
    triggerRealtimeCheck(false);
    const interval = window.setInterval(() => {
      triggerRealtimeCheck(false);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [triggerRealtimeCheck]);

  // Local Storage Mutation Handlers
  const handleSaveConfig = async (updated: Partial<WeddingConfig>) => {
    try {
      const next = updateLocalConfig(state, updated);
      setState(next);
      pushToast('Nama acara, jadwal & pengaturan tersimpan di LocalStorage.');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.', 'error');
      throw err;
    }
  };

  const handleAddItem = async (payload: {
    name: string;
    price: number;
    quantity: number;
    link: string;
    category: VendorCategory;
    purchased: boolean;
    notes: string;
  }) => {
    try {
      const next = addLocalItem(state, payload);
      setState(next);
      pushToast(`Barang "${payload.name}" ditambahkan & tersimpan.`);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Gagal menambah barang.', 'error');
      throw err;
    }
  };

  const handleUpdateItem = async (id: string, payload: Partial<ShoppingItem>) => {
    try {
      const next = updateLocalItem(state, id, payload);
      setState(next);
      pushToast('Daftar barang & total uang keluar tersimpan.');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Gagal memperbarui barang.', 'error');
      throw err;
    }
  };

  const handleDeleteItem = (item: ShoppingItem) => {
    setPendingConfirm({
      title: `Hapus Barang "${item.name}"?`,
      description: 'Barang akan dihapus dari daftar belanja dan perhitungan uang keluar.',
      confirmLabel: 'Hapus Barang',
      destructive: true,
      onConfirm: async () => {
        const next = deleteLocalItem(state, item.id);
        setState(next);
        pushToast(`Barang "${item.name}" dihapus dari penyimpanan lokal.`);
      },
    });
  };

  const handleSaveVendor = async (payload: Partial<VendorItem>, editingId?: string) => {
    try {
      const next = editingId
        ? updateLocalVendor(state, editingId, payload)
        : addLocalVendor(state, payload);
      setState(next);
      pushToast(
        editingId
          ? 'Data vendor & harga diperbarui dan tersimpan.'
          : 'Vendor baru ditambahkan & tersimpan di LocalStorage.'
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Gagal menyimpan data vendor.', 'error');
      throw err;
    }
  };

  const handleDeleteVendor = (vendor: VendorItem) => {
    setPendingConfirm({
      title: `Hapus Vendor "${vendor.name}"?`,
      description:
        'Menghapus vendor ini juga akan menghapus seluruh riwayat pembayaran dan dokumen digital yang terkait dengannya dari penyimpanan lokal.',
      confirmLabel: 'Hapus Vendor',
      destructive: true,
      onConfirm: async () => {
        const token = getWorkspaceAccessToken();
        if (vendor.calendarEventId && token) {
          await deleteGoogleCalendarEvent(token, vendor.calendarEventId);
        }
        const next = await deleteLocalVendor(state, vendor.id);
        setState(next);
        pushToast(`Vendor "${vendor.name}" dihapus.`);
      },
    });
  };

  const handleRecordPayment = async (payload: {
    vendorId: string;
    amount: number;
    paymentDate: string;
    method: PaymentRecord['method'];
    stage: PaymentRecord['stage'];
    referenceNumber: string;
    notes: string;
    receiptFile?: { fileName: string; mimeType: string; base64Data: string } | null;
  }) => {
    try {
      const next = await recordLocalPayment(state, payload);
      setState(next);
      pushToast(
        payload.receiptFile
          ? 'Pembayaran dicatat, Total Uang Keluar diperbarui, dan bukti tersimpan lokal.'
          : 'Pembayaran dicatat & perubahan tersimpan.'
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Gagal mencatat pembayaran.', 'error');
      throw err;
    }
  };

  const handleMarkPaidFull = async (vendor: VendorItem) => {
    const remaining = getVendorRemaining(vendor);
    if (remaining <= 0) return;
    try {
      await handleRecordPayment({
        vendorId: vendor.id,
        amount: remaining,
        paymentDate: new Date().toISOString().split('T')[0],
        method: 'Transfer Bank',
        stage: 'Pelunasan',
        referenceNumber: `LUNAS-${Date.now().toString().slice(-6)}`,
        notes: `Pelunasan otomatis ${vendor.name}`,
        receiptFile: null,
      });
    } catch {
      // Error toast already displayed
    }
  };

  const handleUploadDocument = async (payload: {
    vendorId: string;
    title: string;
    kind: DocumentKind;
    fileName: string;
    mimeType: string;
    base64Data: string;
    notes: string;
  }) => {
    try {
      const next = await uploadLocalDocument(state, payload);
      setState(next);
      pushToast(`Dokumen "${payload.title}" tersimpan di Brankas Lokal.`);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Gagal menyimpan dokumen digital.', 'error');
      throw err;
    }
  };

  const handleDownloadDocument = async (doc: DigitalDocument) => {
    const ok = await downloadLocalDocument(doc);
    if (!ok) {
      pushToast('Berkas tidak ditemukan di penyimpanan lokal browser.', 'error');
    }
  };

  const handleDeleteDocument = (doc: DigitalDocument) => {
    setPendingConfirm({
      title: `Hapus Dokumen "${doc.title}"?`,
      description: 'Berkas digital akan dihapus permanen dari penyimpanan lokal browser Anda.',
      confirmLabel: 'Hapus Dokumen',
      destructive: true,
      onConfirm: async () => {
        const next = await deleteLocalDocument(state, doc.id);
        setState(next);
        pushToast(`Dokumen "${doc.title}" dihapus.`);
      },
    });
  };

  // Google Calendar Sync Handlers
  const loadGoogleCalendarEvents = useCallback(
    async (token: string) => {
      try {
        const items = await fetchUpcomingGoogleCalendarEvents(token);
        setGoogleEvents(items);
      } catch (err) {
        pushToast(
          err instanceof Error ? err.message : 'Gagal membaca agenda Google Calendar.',
          'error'
        );
      }
    },
    [pushToast]
  );

  const handleGoogleLogin = async (): Promise<string | null> => {
    setIsLoggingIn(true);
    try {
      const { user, accessToken } = await googleWorkspaceSignIn();
      setGoogleUser(user);
      setGoogleToken(accessToken);
      pushToast(`Terhubung ke Google Calendar sebagai ${user.email}.`);
      await loadGoogleCalendarEvents(accessToken);
      return accessToken;
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : 'Proses masuk Google dibatalkan.',
        'error'
      );
      return null;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleWorkspaceLogout();
    setGoogleUser(null);
    setGoogleToken(null);
    setGoogleEvents([]);
    pushToast('Sesi Google Calendar diputuskan.');
  };

  const executeSingleVendorSync = async (vendor: VendorItem, token: string) => {
    setSyncingVendorId(vendor.id);
    try {
      const { eventId } = await syncVendorToGoogleCalendar(token, vendor, state.config);
      setState((prev) => updateLocalVendorCalendar(prev, vendor.id, eventId));
      await loadGoogleCalendarEvents(token);
      pushToast(`Jadwal "${vendor.name}" tersinkron ke Google Calendar.`);
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : 'Gagal menyinkronkan acara ke Google Calendar.',
        'error'
      );
    } finally {
      setSyncingVendorId(null);
    }
  };

  const handleSyncVendorToCalendar = async (vendor: VendorItem) => {
    let token = googleToken || getWorkspaceAccessToken();
    if (!token) {
      token = await handleGoogleLogin();
      if (!token) return;
    }

    if (vendor.calendarEventId) {
      setPendingConfirm({
        title: 'Perbarui Acara di Google Calendar?',
        description: `Jadwal "${vendor.name}" sudah ada di Google Calendar Anda. Apakah Anda ingin memperbarui detail dan nominal tagihan terbaru pada acara tersebut?`,
        confirmLabel: 'Perbarui Kalender',
        destructive: false,
        onConfirm: async () => {
          await executeSingleVendorSync(vendor, token!);
        },
      });
      return;
    }

    await executeSingleVendorSync(vendor, token);
  };

  const handleSyncAllToGoogleCalendar = async () => {
    let token = googleToken || getWorkspaceAccessToken();
    if (!token) {
      token = await handleGoogleLogin();
      if (!token) return;
    }

    const existingCount = state.vendors.filter((v) => Boolean(v.calendarEventId)).length;
    const executeBulk = async () => {
      setIsBulkSyncing(true);
      let synced = 0;
      let latestState = state;
      try {
        for (const v of state.vendors) {
          const { eventId } = await syncVendorToGoogleCalendar(token!, v, state.config);
          latestState = updateLocalVendorCalendar(latestState, v.id, eventId);
          synced++;
        }
        setState(latestState);
        await loadGoogleCalendarEvents(token!);
        pushToast(`${synced} jadwal & pengingat tagihan vendor tersinkron ke Google Calendar.`);
      } catch (err) {
        setState(latestState);
        pushToast(
          err instanceof Error ? err.message : 'Sebagian jadwal gagal disinkronkan.',
          'error'
        );
      } finally {
        setIsBulkSyncing(false);
      }
    };

    if (existingCount > 0) {
      setPendingConfirm({
        title: 'Sinkronkan & Perbarui Google Calendar?',
        description: `Sebanyak ${state.vendors.length} vendor akan dikirim ke Google Calendar utama Anda (${existingCount} acara yang sudah ada akan diperbarui dengan nominal sisa tagihan terkini).`,
        confirmLabel: 'Sinkronkan Semua',
        destructive: false,
        onConfirm: executeBulk,
      });
    } else {
      await executeBulk();
    }
  };

  const handleDeleteCalendarEvent = (vendor: VendorItem) => {
    if (!vendor.calendarEventId) return;
    const token = googleToken || getWorkspaceAccessToken();
    if (!token) return;

    setPendingConfirm({
      title: `Hapus Acara "${vendor.name}" dari Google Calendar?`,
      description:
        'Tindakan ini akan menghapus acara pengingat tagihan dari Google Calendar Anda. Data vendor di penyimpanan lokal tetap aman.',
      confirmLabel: 'Hapus dari Google Calendar',
      destructive: true,
      onConfirm: async () => {
        await deleteGoogleCalendarEvent(token, vendor.calendarEventId!);
        setState((prev) => updateLocalVendorCalendar(prev, vendor.id, null));
        await loadGoogleCalendarEvents(token);
        pushToast(`Acara "${vendor.name}" dihapus dari Google Calendar.`);
      },
    });
  };

  const handleDownloadJsonBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStamp = new Date().toISOString().split('T')[0];
    link.download = `RencanaNikah_Cadangan_${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast('File cadangan lokal (.json) berhasil diunduh.');
  };

  const handleImportJsonBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsRestoringBackup(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<WeddingAppState>;
      if (!parsed || typeof parsed !== 'object' || !parsed.config || !Array.isArray(parsed.vendors)) {
        throw new Error('Format file cadangan JSON tidak valid.');
      }
      const restored = restoreLocalState(parsed);
      setState(restored);
      pushToast('Seluruh data berhasil dipulihkan ke LocalStorage browser.');
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : 'Gagal membaca file cadangan JSON.',
        'error'
      );
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleDownloadICS = () => {
    const ics = generateICS(state.vendors, state.config);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Jadwal_Pernikahan_${state.config.coupleNames.replace(/[^a-zA-Z0-9]+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast('File kalender (.ics) diunduh. Dapat diimpor ke Google, Apple, atau Outlook Calendar.');
  };

  const handleRequestBrowserPermission = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      pushToast('Notifikasi browser real-time diaktifkan.');
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
    { id: 'dashboard', label: 'Ringkasan Keuangan', icon: LayoutDashboard },
    { id: 'vendors', label: 'Daftar Vendor & Harga', icon: ListChecks, count: state.vendors.length },
    { id: 'items', label: 'List Barang & Link', icon: ShoppingBag, count: state.items?.length },
    { id: 'calendar', label: 'Kalender & Sinkron', icon: CalendarDays },
    { id: 'documents', label: 'Brankas Dokumen', icon: FileArchive, count: state.documents.length },
    { id: 'notifications', label: 'Pengingat Tagihan', icon: Bell, count: alerts.length },
  ];

  const activeTitle = navItems.find((i) => i.id === activeTab)?.label || 'Ringkasan Keuangan';
  const urgentCount = alerts.filter((a) => a.severity === 'overdue' || a.severity === 'due_today').length;
  const savedTimeText = state.lastUpdated
    ? new Date(state.lastUpdated).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-slate-900 text-slate-100 border-r border-slate-800">
        <div className="h-16 px-6 flex items-center border-b border-slate-800">
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            RencanaNikah
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      item.id === 'notifications' && urgentCount > 0
                        ? 'text-amber-300 font-semibold'
                        : isActive
                        ? 'text-teal-100'
                        : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-2.5">
          <div className="flex items-center justify-between">
            <span>Penyimpanan</span>
            <span className="text-emerald-400 font-mono font-medium tabular-nums">
              Lokal · {savedTimeText}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Google Calendar</span>
            <span className={googleToken ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
              {googleToken ? 'Terhubung' : 'Opsional'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleDownloadJsonBackup}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium inline-flex items-center justify-center gap-1 cursor-pointer"
              title="Unduh file cadangan JSON ke perangkat Anda"
            >
              <Download className="w-3 h-3" /> Cadangan
            </button>
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              disabled={isRestoringBackup}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 rounded-lg text-[11px] font-medium inline-flex items-center justify-center gap-1 cursor-pointer"
              title="Pulihkan data dari file cadangan JSON"
            >
              <Upload className="w-3 h-3" /> {isRestoringBackup ? 'Memulihkan...' : 'Pulihkan'}
            </button>
          </div>
          <PWAInstallButton variant="sidebar" />
          <button
            type="button"
            onClick={() => setAuditModalOpen(true)}
            className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Ekspor PDF / Excel
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[80vw] bg-slate-900 text-slate-100 flex flex-col h-full z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
              <span className="font-display text-lg font-bold text-white">RencanaNikah</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                      isActive ? 'bg-teal-700 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="font-mono text-xs">{item.count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
              <div className="flex items-center justify-between">
                <span>Penyimpanan</span>
                <span className="text-emerald-400 font-mono font-medium tabular-nums">
                  Lokal · {savedTimeText}
                </span>
              </div>
              <PWAInstallButton variant="sidebar" />
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadJsonBackup}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" /> Cadangan
                </button>
                <button
                  type="button"
                  onClick={() => restoreInputRef.current?.click()}
                  disabled={isRestoringBackup}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 rounded-lg text-[11px] font-medium inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3" /> Pulihkan
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka navigasi"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {activeTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton variant="header" />

            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border whitespace-nowrap shrink-0 cursor-pointer ${
                urgentCount > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tagihan</span>
              <span className="font-mono font-semibold tabular-nums">({alerts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAuditModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 bg-white text-slate-700 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Ekspor Audit
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingVendor(null);
                setVendorModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Vendor
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1400px] w-full mx-auto space-y-6">
          {/* Persistent Urgent Real-Time Bill Reminder Strip */}
          {urgentCount > 0 && activeTab !== 'notifications' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>{urgentCount} tagihan vendor</strong> membutuhkan perhatian segera (terlambat atau jatuh tempo hari ini).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className="text-xs font-semibold text-amber-900 hover:underline whitespace-nowrap shrink-0 text-left sm:text-right cursor-pointer"
              >
                Lihat Pengingat Real-Time
              </button>
            </div>
          )}

          {/* Always-Visible Countdown Banner */}
          <CountdownBanner
            config={state.config}
            vendors={state.vendors}
            onQuickSaveNameAndSchedule={handleSaveConfig}
          />

          {/* Tab Content */}
          {activeTab === 'dashboard' && (
            <FinancialDashboard
              config={state.config}
              vendors={state.vendors}
              payments={state.payments}
              documents={state.documents}
              items={state.items || []}
              alerts={alerts}
              onRecordPayment={(vid) => {
                setPaymentVendorId(vid);
                setPaymentModalOpen(true);
              }}
              onAddVendor={() => {
                setEditingVendor(null);
                setVendorModalOpen(true);
              }}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'vendors' && (
            <VendorPriceList
              vendors={state.vendors}
              documents={state.documents}
              isGoogleConnected={Boolean(googleToken)}
              syncingVendorId={syncingVendorId}
              onAddVendor={() => {
                setEditingVendor(null);
                setVendorModalOpen(true);
              }}
              onEditVendor={(v) => {
                setEditingVendor(v);
                setVendorModalOpen(true);
              }}
              onDeleteVendor={handleDeleteVendor}
              onRecordPayment={(vid) => {
                setPaymentVendorId(vid);
                setPaymentModalOpen(true);
              }}
              onMarkPaidFull={handleMarkPaidFull}
              onUploadDocumentForVendor={(vid) => {
                setDocVendorFilter(vid);
                setActiveTab('documents');
              }}
              onSyncVendorToCalendar={handleSyncVendorToCalendar}
            />
          )}

          {activeTab === 'items' && (
            <ShoppingItemList
              items={state.items || []}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
            />
          )}

          {activeTab === 'calendar' && (
            <WeddingCalendarView
              config={state.config}
              vendors={state.vendors}
              googleUser={googleUser}
              isGoogleConnected={Boolean(googleToken)}
              isLoggingIn={isLoggingIn}
              isBulkSyncing={isBulkSyncing}
              googleEvents={googleEvents}
              onGoogleLogin={handleGoogleLogin}
              onGoogleLogout={handleGoogleLogout}
              onSyncAllToGoogleCalendar={handleSyncAllToGoogleCalendar}
              onSyncSingleVendor={handleSyncVendorToCalendar}
              onDeleteCalendarEvent={handleDeleteCalendarEvent}
              onRefreshGoogleEvents={() => {
                if (googleToken) loadGoogleCalendarEvents(googleToken);
              }}
              onDownloadICS={handleDownloadICS}
              onEditVendor={(v) => {
                setEditingVendor(v);
                setVendorModalOpen(true);
              }}
              onEditWeddingConfig={() => setConfigModalOpen(true)}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentVault
              documents={state.documents}
              vendors={state.vendors}
              initialVendorFilter={docVendorFilter}
              onUploadDocument={handleUploadDocument}
              onPreviewDocument={(doc) => setPreviewDoc(doc)}
              onDownloadDocument={handleDownloadDocument}
              onDeleteDocument={handleDeleteDocument}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationCenter
              alerts={alerts}
              config={state.config}
              lastCheckedAt={lastCheckedAt}
              notificationPermission={notificationPermission}
              onRequestBrowserPermission={handleRequestBrowserPermission}
              onToggleSound={(enabled) => {
                void handleSaveConfig({ ...state.config, soundAlertsEnabled: enabled }).catch(
                  () => {}
                );
              }}
              onUpdateLeadDays={(days) => {
                void handleSaveConfig({ ...state.config, reminderLeadDays: days }).catch(() => {});
              }}
              onRecordPayment={(vid) => {
                setPaymentVendorId(vid);
                setPaymentModalOpen(true);
              }}
              onTestLiveAlert={() => triggerRealtimeCheck(true)}
            />
          )}
        </main>
        <input
          ref={restoreInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportJsonBackup}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Live Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border shadow-lg text-xs font-medium ${
                t.tone === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : t.tone === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              {t.tone === 'error' || t.tone === 'warning' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-relaxed">{t.text}</span>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="opacity-70 hover:opacity-100 cursor-pointer"
                aria-label="Tutup notifikasi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <WeddingConfigModal
        isOpen={configModalOpen}
        config={state.config}
        onClose={() => setConfigModalOpen(false)}
        onSave={handleSaveConfig}
      />

      <VendorModal
        isOpen={vendorModalOpen}
        editingVendor={editingVendor}
        onClose={() => setVendorModalOpen(false)}
        onSave={handleSaveVendor}
      />

      <PaymentModal
        isOpen={paymentModalOpen}
        vendors={state.vendors}
        preselectedVendorId={paymentVendorId}
        onClose={() => setPaymentModalOpen(false)}
        onSubmitPayment={handleRecordPayment}
      />

      <AuditExportModal
        isOpen={auditModalOpen}
        state={state}
        onClose={() => setAuditModalOpen(false)}
        onExportPDF={() => {
          const name = exportAuditPDF(state);
          setAuditModalOpen(false);
          pushToast(`Laporan PDF "${name}" berhasil diunduh.`);
        }}
        onExportExcel={() => {
          const name = exportAuditExcel(state);
          setAuditModalOpen(false);
          pushToast(`Workbook Excel "${name}" berhasil diunduh.`);
        }}
      />

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      <ConfirmModal
        isOpen={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        confirmLabel={pendingConfirm?.confirmLabel || 'Konfirmasi'}
        destructive={pendingConfirm?.destructive ?? true}
        loading={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) setPendingConfirm(null);
        }}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          setConfirmBusy(true);
          try {
            await pendingConfirm.onConfirm();
            setPendingConfirm(null);
          } catch (err) {
            pushToast(
              err instanceof Error ? err.message : 'Gagal menjalankan tindakan.',
              'error'
            );
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
      <OfflineIndicator />
    </div>
  );
}
