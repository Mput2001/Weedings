import { useState } from 'react';
import { Check, Copy, Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar';
}

export function PWAInstallButton({ variant = 'header' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full py-2 px-3 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5" />
          {isInstallable ? 'Pasang Aplikasi' : 'Jadikan Aplikasi (PWA)'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-teal-200 bg-teal-50 text-teal-800 rounded-lg hover:bg-teal-100 whitespace-nowrap shrink-0 cursor-pointer"
          title="Pasang RencanaNikah sebagai aplikasi di HP atau Desktop"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Pasang Aplikasi</span>
        </button>
      )}

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4 text-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {isIOS ? 'Pasang di iPhone / iPad' : 'Pasang RencanaNikah sebagai Aplikasi'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Berjalan offline penuh dengan data tersimpan di perangkat Anda
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Tutup panduan pasang aplikasi"
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="text-xs text-slate-700 space-y-2 list-decimal pl-4 leading-relaxed">
                <li>
                  Buka aplikasi ini langsung di browser <strong>Safari</strong>.
                </li>
                <li>
                  Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah atau atas Safari.
                </li>
                <li>
                  Gulir ke bawah lalu pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
                </li>
              </ol>
            ) : (
              <ol className="text-xs text-slate-700 space-y-2 list-decimal pl-4 leading-relaxed">
                <li>
                  Pastikan aplikasi dibuka langsung di tab penuh <strong>Chrome, Edge, atau Safari</strong> (bukan di dalam pratinjau frame).
                </li>
                <li>
                  <strong>Android (Chrome):</strong> Ketuk menu titik tiga (⋮) di kanan atas &rarr; pilih <strong>Instal aplikasi / Tambahkan ke layar utama</strong>.
                </li>
                <li>
                  <strong>Laptop / Desktop (Chrome/Edge):</strong> Klik ikon <strong>Instal (Install)</strong> di sisi kanan kolom alamat URL browser.
                </li>
              </ol>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-600 truncate">
                {typeof window !== 'undefined' ? window.location.origin : ''}
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-100 shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-700" /> Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Salin Link
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Mode Offline — Data tetap tersimpan lokal</span>
    </div>
  );
}
