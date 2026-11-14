import { useMemo, useRef, useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { DigitalDocument, DocumentKind, VendorItem } from '../types';
import { formatDateTimeID, formatFileSize } from '../utils/formatters';

interface DocumentVaultProps {
  documents: DigitalDocument[];
  vendors: VendorItem[];
  initialVendorFilter?: string;
  onUploadDocument: (payload: {
    vendorId: string;
    title: string;
    kind: DocumentKind;
    fileName: string;
    mimeType: string;
    base64Data: string;
    notes: string;
  }) => Promise<void>;
  onPreviewDocument: (doc: DigitalDocument) => void;
  onDownloadDocument: (doc: DigitalDocument) => void;
  onDeleteDocument: (doc: DigitalDocument) => void;
}

const DOC_KINDS: DocumentKind[] = [
  'Kontrak Vendor',
  'Bukti Pembayaran',
  'Invoice',
  'Proposal / Penawaran',
];

export function DocumentVault({
  documents,
  vendors,
  initialVendorFilter = 'Semua',
  onUploadDocument,
  onPreviewDocument,
  onDownloadDocument,
  onDeleteDocument,
}: DocumentVaultProps) {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'Semua' | DocumentKind>('Semua');
  const [vendorFilter, setVendorFilter] = useState<string>(initialVendorFilter);

  // Upload form state
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadVendorId, setUploadVendorId] = useState<string>(vendors[0]?.id || '');
  const [uploadKind, setUploadKind] = useState<DocumentKind>('Kontrak Vendor');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    size: number;
    base64Data: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      const vName = vendorMap.get(d.vendorId)?.name || '';
      const matchesSearch =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        vName.toLowerCase().includes(q);
      const matchesKind = kindFilter === 'Semua' || d.kind === kindFilter;
      const matchesVendor = vendorFilter === 'Semua' || d.vendorId === vendorFilter;
      return matchesSearch && matchesKind && matchesVendor;
    });
  }, [documents, search, kindFilter, vendorFilter, vendorMap]);

  const handleFileChange = (file: File | undefined) => {
    setUploadError('');
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 12 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setSelectedFile({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        base64Data: result,
      });
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Pilih file kontrak atau bukti pembayaran terlebih dahulu.');
      return;
    }
    const targetVendorId = uploadVendorId || vendors[0]?.id || '';
    if (!targetVendorId) {
      setUploadError('Tambahkan minimal satu vendor sebelum mengunggah dokumen.');
      return;
    }

    try {
      setUploading(true);
      setUploadError('');
      await onUploadDocument({
        vendorId: targetVendorId,
        title: uploadTitle.trim() || selectedFile.name,
        kind: uploadKind,
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        base64Data: selectedFile.base64Data,
        notes: uploadNotes.trim(),
      });
      setSelectedFile(null);
      setUploadTitle('');
      setUploadNotes('');
      setShowUploadPanel(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Gagal mengunggah dokumen.');
    } finally {
      setUploading(false);
    }
  };

  const contractCount = documents.filter((d) => d.kind === 'Kontrak Vendor').length;
  const receiptCount = documents.filter((d) => d.kind === 'Bukti Pembayaran').length;

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Brankas Dokumen Digital (Penyimpanan Lokal)
          </h3>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {documents.length} Total Berkas · {contractCount} Kontrak Vendor · {receiptCount} Bukti Pembayaran · Tersimpan lokal di browser Anda
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!uploadVendorId && vendors[0]) setUploadVendorId(vendors[0].id);
            setShowUploadPanel((prev) => !prev);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          {showUploadPanel ? 'Tutup Form Unggah' : 'Unggah Kontrak / Bukti Bayar'}
        </button>
      </div>

      {/* Collapsible Upload Panel */}
      {showUploadPanel && (
        <form
          onSubmit={handleSubmitUpload}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-semibold text-slate-900">
              Simpan Dokumen Digital Baru
            </h4>
            <span className="text-xs text-slate-500">
              Mendukung PDF, JPG, PNG, SVG, DOCX (Maks. 12 MB)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Vendor Terkait
              </label>
              <select
                value={uploadVendorId || vendors[0]?.id || ''}
                onChange={(e) => setUploadVendorId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Kategori Dokumen
              </label>
              <select
                value={uploadKind}
                onChange={(e) => setUploadKind(e.target.value as DocumentKind)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              >
                {DOC_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Judul Dokumen
              </label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Misal: Kontrak Pelaminan Final"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.doc,.docx"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-5 px-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100/70 transition-colors text-center cursor-pointer"
              >
                <FolderOpen className="w-5 h-5 text-teal-700 mx-auto mb-1.5" />
                {selectedFile ? (
                  <div className="text-xs font-medium text-slate-900">
                    {selectedFile.name} · {formatFileSize(selectedFile.size)}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600">
                    Klik untuk memilih berkas kontrak atau bukti transfer
                  </div>
                )}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Catatan Audit (Opsional)
              </label>
              <textarea
                rows={3}
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Nomor referensi transfer, klausul penting, atau tanggal tanda tangan..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          {uploadError && <p className="text-xs font-medium text-red-700">{uploadError}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowUploadPanel(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {uploading ? 'Menyimpan Berkas...' : 'Simpan ke Brankas Digital'}
            </button>
          </div>
        </form>
      )}

      {/* Filter & Document Table */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul dokumen atau nama file..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              aria-label="Filter vendor"
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-teal-700"
            >
              <option value="Semua">Semua Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['Semua', ...DOC_KINDS] as ('Semua' | DocumentKind)[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setKindFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  kindFilter === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredDocs.length === 0 ? (
            <div className="py-14 px-6 text-center text-sm text-slate-500">
              Belum ada dokumen pada filter ini. Unggah kontrak atau bukti pembayaran agar arsip audit lengkap.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 pl-5 pr-3">Dokumen & Berkas</th>
                  <th className="py-3 px-3">Kategori & Vendor</th>
                  <th className="py-3 px-3">Diunggah</th>
                  <th className="py-3 pr-5 pl-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredDocs.map((doc) => {
                  const vendor = vendorMap.get(doc.vendorId);
                  const isImage = doc.mimeType.startsWith('image/');
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 pl-5 pr-3 align-top">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 text-teal-700 shrink-0">
                            {isImage ? (
                              <ImageIcon className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">{doc.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5 font-mono">
                              {doc.fileName} · {formatFileSize(doc.fileSize)}
                            </div>
                            {doc.notes && (
                              <div className="text-xs text-slate-600 mt-1">{doc.notes}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top text-xs">
                        <div className="font-semibold text-slate-800">{doc.kind}</div>
                        <div className="text-slate-500 mt-0.5">
                          {vendor?.name || 'Vendor Umum'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top text-xs font-mono text-slate-600 whitespace-nowrap">
                        {formatDateTimeID(doc.uploadedAt)}
                      </td>

                      <td className="py-3.5 pr-5 pl-3 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onPreviewDocument(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-100 text-slate-800 rounded-md hover:bg-slate-200 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Pratinjau
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadDocument(doc)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                            title="Unduh Berkas"
                            aria-label={`Unduh dokumen ${doc.title}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteDocument(doc)}
                            aria-label={`Hapus dokumen ${doc.title}`}
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
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
