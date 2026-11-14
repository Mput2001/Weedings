import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Upload, X } from 'lucide-react';
import {
  DigitalDocument,
  PaymentRecord,
  VENDOR_CATEGORIES,
  VendorCategory,
  VendorItem,
  WeddingConfig,
} from '../types';
import {
  dataUrlToBlobUrl,
  downloadLocalDocument,
  getLocalDocumentDataUrl,
} from '../services/localWeddingStorage';
import { formatFileSize, formatIDR, getVendorRemaining } from '../utils/formatters';

/* ---------------- Wedding Settings Modal ---------------- */
interface ConfigModalProps {
  isOpen: boolean;
  config: WeddingConfig;
  onClose: () => void;
  onSave: (updated: WeddingConfig) => Promise<void>;
}

export function WeddingConfigModal({ isOpen, config, onClose, onSave }: ConfigModalProps) {
  const [form, setForm] = useState<WeddingConfig>(config);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Edit Nama, Jadwal & Pengingat Acara
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Pasangan
              </label>
              <input
                type="text"
                required
                value={form.coupleNames}
                onChange={(e) => setForm({ ...form, coupleNames: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal & Waktu Hari-H
              </label>
              <input
                type="datetime-local"
                required
                value={form.weddingDate.slice(0, 16)}
                onChange={(e) => setForm({ ...form, weddingDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Venue
              </label>
              <input
                type="text"
                required
                value={form.venueName}
                onChange={(e) => setForm({ ...form, venueName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kota
              </label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Jendela Pengingat Tagihan (Hari Sebelum Jatuh Tempo)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              required
              value={form.reminderLeadDays}
              onChange={(e) => setForm({ ...form, reminderLeadDays: Number(e.target.value) })}
              className="w-full sm:w-48 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Add / Edit Vendor Modal ---------------- */
interface VendorModalProps {
  isOpen: boolean;
  editingVendor: VendorItem | null;
  onClose: () => void;
  onSave: (payload: Partial<VendorItem>, editingId?: string) => Promise<void>;
}

export function VendorModal({ isOpen, editingVendor, onClose, onSave }: VendorModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<VendorCategory>('Venue & Katering');
  const [picName, setPicName] = useState('');
  const [picPhone, setPicPhone] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [contractPrice, setContractPrice] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLabel, setEventLabel] = useState('Technical Meeting');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingVendor) {
      setName(editingVendor.name);
      setCategory(editingVendor.category);
      setPicName(editingVendor.picName);
      setPicPhone(editingVendor.picPhone);
      setServiceDescription(editingVendor.serviceDescription);
      setEstimatedPrice(editingVendor.estimatedPrice);
      setContractPrice(editingVendor.contractPrice);
      setPaidAmount(editingVendor.paidAmount);
      setDueDate(editingVendor.dueDate);
      setEventDate(editingVendor.eventDate);
      setEventLabel(editingVendor.eventLabel || 'Jadwal Vendor');
      setNotes(editingVendor.notes);
    } else {
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      setName('');
      setCategory('Venue & Katering');
      setPicName('');
      setPicPhone('');
      setServiceDescription('');
      setEstimatedPrice(0);
      setContractPrice(0);
      setPaidAmount(0);
      setDueDate(nextWeek);
      setEventDate(nextMonth);
      setEventLabel('Technical Meeting');
      setNotes('');
    }
  }, [editingVendor, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(
        {
          name,
          category,
          picName,
          picPhone,
          serviceDescription,
          estimatedPrice,
          contractPrice: contractPrice > 0 ? contractPrice : estimatedPrice,
          paidAmount,
          dueDate,
          eventDate,
          eventLabel,
          notes,
        },
        editingVendor?.id
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {editingVendor ? `Ubah Vendor: ${editingVendor.name}` : 'Tambah Vendor & List Harga'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Vendor / Item
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: Katering Puspa Rasa"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VendorCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
              >
                {VENDOR_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama PIC Vendor
              </label>
              <input
                type="text"
                value={picName}
                onChange={(e) => setPicName(e.target.value)}
                placeholder="Nama penanggung jawab"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nomor WhatsApp / Telepon
              </label>
              <input
                type="text"
                value={picPhone}
                onChange={(e) => setPicPhone(e.target.value)}
                placeholder="0812-xxxx-xxxx"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Rincian Paket / Layanan
            </label>
            <input
              type="text"
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              placeholder="Cakupan layanan, jumlah pax, bonus..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Estimasi Harga (IDR)
              </label>
              <input
                type="number"
                min={0}
                required
                value={estimatedPrice}
                onChange={(e) => setEstimatedPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Harga Kontrak Final (IDR)
              </label>
              <input
                type="number"
                min={0}
                value={contractPrice}
                onChange={(e) => setContractPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:border-teal-700"
              />
            </div>

            {!editingVendor && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  DP Awal Sudah Dibayar (IDR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:border-teal-700"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal Jatuh Tempo Tagihan
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal Agenda Kalender
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Agenda (Fitting/TM)
              </label>
              <input
                type="text"
                value={eventLabel}
                onChange={(e) => setEventLabel(e.target.value)}
                placeholder="Misal: Fitting Baju"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan Tambahan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Menyimpan...' : editingVendor ? 'Simpan Perubahan' : 'Simpan Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Record Payment Modal (with Digital Receipt Upload) ---------------- */
interface PaymentModalProps {
  isOpen: boolean;
  vendors: VendorItem[];
  preselectedVendorId?: string;
  onClose: () => void;
  onSubmitPayment: (payload: {
    vendorId: string;
    amount: number;
    paymentDate: string;
    method: PaymentRecord['method'];
    stage: PaymentRecord['stage'];
    referenceNumber: string;
    notes: string;
    receiptFile?: { fileName: string; mimeType: string; base64Data: string } | null;
  }) => Promise<void>;
}

export function PaymentModal({
  isOpen,
  vendors,
  preselectedVendorId,
  onClose,
  onSubmitPayment,
}: PaymentModalProps) {
  const [vendorId, setVendorId] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<PaymentRecord['method']>('Transfer Bank');
  const [stage, setStage] = useState<PaymentRecord['stage']>('Termin / Cicilan');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<{
    fileName: string;
    mimeType: string;
    size: number;
    base64Data: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const defaultVendor =
      vendors.find((v) => v.id === preselectedVendorId) ||
      vendors.find((v) => getVendorRemaining(v) > 0) ||
      vendors[0];
    if (defaultVendor) {
      setVendorId(defaultVendor.id);
      const rem = getVendorRemaining(defaultVendor);
      setAmount(rem > 0 ? rem : 0);
      setStage(defaultVendor.paidAmount === 0 ? 'DP / Uang Muka' : 'Pelunasan');
    }
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReferenceNumber('');
    setNotes('');
    setReceiptFile(null);
  }, [isOpen, preselectedVendorId, vendors]);

  if (!isOpen) return null;

  const selectedVendor = vendors.find((v) => v.id === vendorId);
  const remaining = selectedVendor ? getVendorRemaining(selectedVendor) : 0;

  const handleFilePick = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptFile({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        base64Data: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || amount <= 0) return;
    setSubmitting(true);
    try {
      await onSubmitPayment({
        vendorId,
        amount,
        paymentDate,
        method,
        stage,
        referenceNumber,
        notes,
        receiptFile: receiptFile
          ? {
              fileName: receiptFile.fileName,
              mimeType: receiptFile.mimeType,
              base64Data: receiptFile.base64Data,
            }
          : null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Catat Pembayaran & Unggah Bukti
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Pilih Vendor
            </label>
            <select
              value={vendorId}
              onChange={(e) => {
                const v = vendors.find((item) => item.id === e.target.value);
                setVendorId(e.target.value);
                if (v) setAmount(getVendorRemaining(v));
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} (Sisa: {formatIDR(getVendorRemaining(v))})
                </option>
              ))}
            </select>
            {selectedVendor && (
              <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                Sisa kewajiban saat ini: {formatIDR(remaining)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nominal Dibayar (IDR)
              </label>
              <input
                type="number"
                min={1}
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal Pembayaran
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tahap Pembayaran
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as PaymentRecord['stage'])}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
              >
                <option value="Booking Fee">Booking Fee</option>
                <option value="DP / Uang Muka">DP / Uang Muka</option>
                <option value="Termin / Cicilan">Termin / Cicilan</option>
                <option value="Pelunasan">Pelunasan</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Metode Pembayaran
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentRecord['method'])}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
              >
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="Virtual Account">Virtual Account</option>
                <option value="QRIS">QRIS</option>
                <option value="Kartu Kredit">Kartu Kredit</option>
                <option value="Tunai">Tunai</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nomor Referensi / Resi Bank
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Misal: TRX-BCA-2026-99102"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono focus:outline-none focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Lampirkan Bukti Pembayaran Digital (Langsung Tersimpan ke Brankas)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.svg"
              onChange={(e) => handleFilePick(e.target.files?.[0])}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full py-3 px-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs text-slate-700 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-teal-700" />
              {receiptFile
                ? `${receiptFile.fileName} (${formatFileSize(receiptFile.size)})`
                : 'Pilih Gambar / PDF Bukti Transfer (Opsional)'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan Transaksi
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Keterangan tambahan..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Memproses...' : 'Simpan Pembayaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Document Preview Modal ---------------- */
interface DocumentPreviewModalProps {
  doc: DigitalDocument | null;
  onClose: () => void;
}

export function DocumentPreviewModal({ doc, onClose }: DocumentPreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!doc) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    let revokeFn: (() => void) | null = null;
    setLoadingPreview(true);
    setPreviewUrl(null);

    getLocalDocumentDataUrl(doc)
      .then((dataUrl) => {
        if (cancelled || !dataUrl) return;
        const { blobUrl, revoke } = dataUrlToBlobUrl(dataUrl);
        revokeFn = revoke;
        setPreviewUrl(blobUrl);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
      if (revokeFn) revokeFn();
    };
  }, [doc]);

  if (!doc) return null;
  const isImage = doc.mimeType.startsWith('image/');
  const isPdf = doc.mimeType === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{doc.title}</h3>
            <p className="text-xs text-slate-500 font-mono truncate">
              {doc.kind} · {doc.fileName} · {formatFileSize(doc.fileSize)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void downloadLocalDocument(doc)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-700 text-white rounded-lg hover:bg-teal-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Unduh
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau"
              className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100 p-4 overflow-auto flex items-center justify-center min-h-[420px]">
          {loadingPreview ? (
            <div className="text-xs text-slate-500">Memuat berkas dari penyimpanan lokal...</div>
          ) : !previewUrl ? (
            <div className="text-center p-8 bg-white border border-slate-200 rounded-xl max-w-md">
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-900">
                Berkas tidak ditemukan di penyimpanan lokal
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Silakan unggah ulang dokumen ini pada Brankas Dokumen.
              </p>
            </div>
          ) : isImage ? (
            <img
              src={previewUrl}
              alt={doc.title}
              className="max-w-full max-h-[72vh] rounded-lg border border-slate-200 bg-white object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={previewUrl}
              title={doc.title}
              className="w-full h-[72vh] rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div className="text-center p-8 bg-white border border-slate-200 rounded-xl max-w-md">
              <FileText className="w-10 h-10 text-teal-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-900">
                Pratinjau langsung tidak tersedia untuk format ini
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Silakan unduh file untuk membukanya secara lokal.
              </p>
              <button
                type="button"
                onClick={() => void downloadLocalDocument(doc)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Unduh Berkas
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Confirmation Dialog (for Deletions & Workspace Mutations) ---------------- */
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  destructive = true,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer disabled:opacity-60 ${
              destructive
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
