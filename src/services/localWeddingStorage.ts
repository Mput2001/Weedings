import {
  DigitalDocument,
  DocumentKind,
  PaymentRecord,
  ShoppingItem,
  VendorCategory,
  VendorItem,
  WeddingAppState,
  WeddingConfig,
} from '../types';

export const LOCAL_STORAGE_KEY = 'rencananikah_state_v1';
const SMALL_FILES_STORAGE_KEY = 'rencananikah_small_files_v1';
const IDB_NAME = 'rencananikah_files_db';
const IDB_STORE = 'documents';

interface StoredLocalFile {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

function addDaysISO(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createSampleReceiptDataUrl(
  vendorName: string,
  amountText: string,
  ref: string,
  dateText: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="460" viewBox="0 0 760 460">
  <rect width="760" height="460" fill="#f8fafc"/>
  <rect x="32" y="32" width="696" height="396" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
  <rect x="32" y="32" width="696" height="72" rx="12" fill="#0f172a"/>
  <text x="64" y="75" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold">BUKTI TRANSFER PEMBAYARAN VENDOR</text>
  <text x="64" y="148" fill="#64748b" font-family="sans-serif" font-size="13">DITERIMA OLEH VENDOR</text>
  <text x="64" y="174" fill="#0f172a" font-family="sans-serif" font-size="20" font-weight="bold">${vendorName}</text>
  <line x1="64" y1="202" x2="696" y2="202" stroke="#e2e8f0"/>
  <text x="64" y="240" fill="#64748b" font-family="sans-serif" font-size="13">NOMINAL PEMBAYARAN</text>
  <text x="64" y="274" fill="#0f766e" font-family="monospace" font-size="30" font-weight="bold">${amountText}</text>
  <text x="64" y="330" fill="#64748b" font-family="sans-serif" font-size="13">NOMOR REFERENSI AUDIT</text>
  <text x="64" y="354" fill="#0f172a" font-family="monospace" font-size="15">${ref}</text>
  <text x="420" y="330" fill="#64748b" font-family="sans-serif" font-size="13">TANGGAL TRANSAKSI</text>
  <text x="420" y="354" fill="#0f172a" font-family="sans-serif" font-size="15">${dateText}</text>
  <rect x="520" y="232" width="160" height="44" rx="6" fill="#ecfdf5" stroke="#10b981"/>
  <text x="600" y="260" text-anchor="middle" fill="#047857" font-family="sans-serif" font-size="15" font-weight="bold">TERVERIFIKASI</text>
</svg>`;
  return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
}

function createSampleContractDataUrl(title: string, vendor: string, valueText: string): string {
  const safeText = (s: string) => s.replace(/[()\\]/g, '');
  const stream = `BT
/F1 16 Tf
50 760 Td
(${safeText(title)}) Tj
/F1 11 Tf
0 -28 Td
(Pihak Vendor: ${safeText(vendor)}) Tj
0 -20 Td
(Nilai Kontrak Disepakati: ${safeText(valueText)}) Tj
0 -20 Td
(Status Dokumen: Arsip Kontrak Resmi Wedding Planner) Tj
0 -28 Td
(Ketentuan Utama:) Tj
0 -18 Td
(1. Jadwal pelunasan mengikuti tanggal jatuh tempo pada sistem ledger.) Tj
0 -18 Td
(2. Perubahan spesifikasi layanan wajib dituangkan dalam adendum tertulis.) Tj
0 -18 Td
(3. Bukti transfer wajib diunggah sebagai lampiran audit keuangan internal.) Tj
ET`;
  const objs: string[] = [];
  objs.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objs.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objs.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
  );
  objs.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  objs.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objs) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return `data:application/pdf;base64,${utf8ToBase64(pdf)}`;
}

function getSampleDocumentDataUrl(docId: string): string | null {
  const now = new Date();
  if (docId === 'doc_contract_venue') {
    return createSampleContractDataUrl(
      'PERJANJIAN KERJASAMA VENUE & KATERING',
      'Grand Pendopo Nusantara Ballroom',
      'Rp 165.000.000'
    );
  }
  if (docId === 'doc_receipt_venue') {
    return createSampleReceiptDataUrl(
      'Grand Pendopo Nusantara Ballroom',
      'Rp 65.000.000',
      'TRX-BCA-2026-00841',
      addDaysISO(now, -25)
    );
  }
  if (docId === 'doc_contract_decor') {
    return createSampleContractDataUrl(
      'SURAT PERINTAH KERJA DEKORASI',
      'Atelier Floret & Lighting',
      'Rp 58.000.000'
    );
  }
  return null;
}

/* ---------------- Browser Binary File Store (IndexedDB + small localStorage fallback) ---------------- */
function openFilesDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readSmallFilesMap(): Record<string, StoredLocalFile> {
  try {
    const raw = window.localStorage.getItem(SMALL_FILES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredLocalFile>) : {};
  } catch {
    return {};
  }
}

function writeSmallFilesMap(map: Record<string, StoredLocalFile>): void {
  try {
    window.localStorage.setItem(SMALL_FILES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota issues for fallback map
  }
}

async function saveLocalFile(file: StoredLocalFile): Promise<void> {
  const db = await openFilesDB();
  if (db) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(file);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Gagal menyimpan berkas ke penyimpanan lokal'));
    });
    return;
  }

  // Fallback to localStorage if IndexedDB is unavailable
  const map = readSmallFilesMap();
  map[file.id] = file;
  writeSmallFilesMap(map);
}

async function deleteLocalFile(id: string): Promise<void> {
  const db = await openFilesDB();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  const map = readSmallFilesMap();
  if (map[id]) {
    delete map[id];
    writeSmallFilesMap(map);
  }
}

export async function getLocalDocumentDataUrl(doc: DigitalDocument): Promise<string | null> {
  const db = await openFilesDB();
  if (db) {
    const found = await new Promise<StoredLocalFile | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(doc.id);
      req.onsuccess = () => resolve((req.result as StoredLocalFile | undefined) || null);
      req.onerror = () => resolve(null);
    });
    if (found?.dataUrl) return found.dataUrl;
  }

  const map = readSmallFilesMap();
  if (map[doc.id]?.dataUrl) return map[doc.id].dataUrl;

  const sampleDataUrl = getSampleDocumentDataUrl(doc.id);
  if (sampleDataUrl) {
    await saveLocalFile({
      id: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      dataUrl: sampleDataUrl,
    });
    return sampleDataUrl;
  }

  return null;
}

export function dataUrlToBlobUrl(dataUrl: string): { blobUrl: string; revoke: () => void } {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    return { blobUrl: dataUrl, revoke: () => {} };
  }
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  return {
    blobUrl,
    revoke: () => URL.revokeObjectURL(blobUrl),
  };
}

export async function downloadLocalDocument(doc: DigitalDocument): Promise<boolean> {
  const dataUrl = await getLocalDocumentDataUrl(doc);
  if (!dataUrl) return false;
  const { blobUrl, revoke } = dataUrlToBlobUrl(dataUrl);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = doc.fileName || `${doc.title}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(revoke, 1500);
  return true;
}

/* ---------------- Initial State & Normalization ---------------- */
function createInitialLocalState(): WeddingAppState {
  const now = new Date();
  const weddingDay = addDaysISO(now, 88);
  const nowISO = now.toISOString();

  const vendors: VendorItem[] = [
    {
      id: 'v_venue',
      name: 'Grand Pendopo Nusantara Ballroom',
      category: 'Venue & Katering',
      picName: 'Raka Pratama',
      picPhone: '0812-8840-1120',
      serviceDescription: 'Ballroom kapasitas 600 tamu + 500 pax prasmanan & 4 gubukan VIP',
      estimatedPrice: 160000000,
      contractPrice: 165000000,
      paidAmount: 65000000,
      dueDate: addDaysISO(now, 3),
      eventDate: addDaysISO(now, 14),
      eventLabel: 'Test Food & Layout Meja',
      notes: 'Termin kedua sebesar Rp 50 jt jatuh tempo H+3, pelunasan H-14.',
      calendarEventId: null,
      calendarSyncedAt: null,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
    {
      id: 'v_decor',
      name: 'Atelier Floret & Lighting',
      category: 'Dekorasi & Pencahayaan',
      picName: 'Nadia Kusuma',
      picPhone: '0811-9320-4451',
      serviceDescription: 'Pelaminan 14m, bunga segar lokal & impor, gate masuk & ambiens lighting',
      estimatedPrice: 55000000,
      contractPrice: 58000000,
      paidAmount: 20000000,
      dueDate: addDaysISO(now, -2),
      eventDate: addDaysISO(now, 21),
      eventLabel: 'Survei Loading & Mockup Bunga',
      notes: 'Termin DP II belum diselesaikan, hubungi Nadia untuk konfirmasi transfer.',
      calendarEventId: null,
      calendarSyncedAt: null,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
    {
      id: 'v_photo',
      name: 'Lensa Senja Studio',
      category: 'Dokumentasi (Foto & Video)',
      picName: 'Bagas Wijaya',
      picPhone: '0813-7721-9088',
      serviceDescription: '2 Fotografer, 2 Videografer, Same-Day Edit, album cetak 30x40cm',
      estimatedPrice: 32000000,
      contractPrice: 30000000,
      paidAmount: 30000000,
      dueDate: addDaysISO(now, -10),
      eventDate: addDaysISO(now, 10),
      eventLabel: 'Sesi Pre-Wedding Outdoor',
      notes: 'Sudah lunas 100%, termasuk bonus cetak kanvas 60x90cm.',
      calendarEventId: null,
      calendarSyncedAt: null,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
    {
      id: 'v_attire',
      name: 'Sari Anggun Kebaya & MUA',
      category: 'Busana & Tata Rias',
      picName: 'Mba Sari',
      picPhone: '0815-6012-3344',
      serviceDescription: 'Busana akad & resepsi sepasang pengantin + makeup ibu & besan (4 orang)',
      estimatedPrice: 35000000,
      contractPrice: 34000000,
      paidAmount: 15000000,
      dueDate: addDaysISO(now, 0),
      eventDate: addDaysISO(now, 18),
      eventLabel: 'Fitting Kebaya & Beskap Tahap 1',
      notes: 'Cicilan kedua jatuh tempo hari ini sebelum jadwal fitting.',
      calendarEventId: null,
      calendarSyncedAt: null,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
    {
      id: 'v_mc',
      name: 'Harmoni Akustik & MC',
      category: 'Hiburan, MC & Audio',
      picName: 'Dimas Aditya',
      picPhone: '0817-4450-8811',
      serviceDescription: 'MC Bilingual Akad-Resepsi + Band Akustik 5 personel + Sound System 5000W',
      estimatedPrice: 18000000,
      contractPrice: 17500000,
      paidAmount: 5000000,
      dueDate: addDaysISO(now, 25),
      eventDate: addDaysISO(now, 45),
      eventLabel: 'Technical Meeting & Cek Lagu',
      notes: 'Pelunasan H-30 sebelum hari acara.',
      calendarEventId: null,
      calendarSyncedAt: null,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
    {
      id: 'v_invite',
      name: 'Kertas Temu & Suvenir Artisan',
      category: 'Undangan & Suvenir',
      picName: 'Tania Putri',
      picPhone: '0819-2039-7712',
      serviceDescription: '400 Undangan cetak letterpress + Undangan digital + 500 suvenir keramik',
      estimatedPrice: 15000000,
      contractPrice: 14500000,
      paidAmount: 7000000,
      dueDate: addDaysISO(now, 12),
      eventDate: addDaysISO(now, 30),
      eventLabel: 'Finalisasi Proof Cetak & Pengiriman',
      notes: 'Cek ulang daftar tamu VIP sebelum cetak final.',
      calendarEventId: null,
      calendarSyncedAt: null,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'pay_1',
      vendorId: 'v_venue',
      amount: 65000000,
      paymentDate: addDaysISO(now, -25),
      method: 'Transfer Bank',
      stage: 'DP / Uang Muka',
      referenceNumber: 'TRX-BCA-2026-00841',
      notes: 'Booking date & DP tahap 1 Ballroom + Katering',
      documentId: 'doc_receipt_venue',
      createdAt: nowISO,
    },
    {
      id: 'pay_2',
      vendorId: 'v_decor',
      amount: 20000000,
      paymentDate: addDaysISO(now, -20),
      method: 'Virtual Account',
      stage: 'DP / Uang Muka',
      referenceNumber: 'VA-MDR-9910421',
      notes: 'Down Payment 35% penguncian tanggal dekorasi',
      documentId: null,
      createdAt: nowISO,
    },
    {
      id: 'pay_3',
      vendorId: 'v_photo',
      amount: 30000000,
      paymentDate: addDaysISO(now, -12),
      method: 'Transfer Bank',
      stage: 'Pelunasan',
      referenceNumber: 'TRX-BCA-2026-01102',
      notes: 'Pelunasan penuh paket dokumentasi + bonus cetak',
      documentId: null,
      createdAt: nowISO,
    },
    {
      id: 'pay_4',
      vendorId: 'v_attire',
      amount: 15000000,
      paymentDate: addDaysISO(now, -18),
      method: 'Transfer Bank',
      stage: 'DP / Uang Muka',
      referenceNumber: 'TRX-BNI-778210',
      notes: 'DP pertama paket busana pengantin dan orang tua',
      documentId: null,
      createdAt: nowISO,
    },
    {
      id: 'pay_5',
      vendorId: 'v_mc',
      amount: 5000000,
      paymentDate: addDaysISO(now, -15),
      method: 'QRIS',
      stage: 'Booking Fee',
      referenceNumber: 'QRIS-2026-55021',
      notes: 'Lock jadwal MC & Band Akustik',
      documentId: null,
      createdAt: nowISO,
    },
    {
      id: 'pay_6',
      vendorId: 'v_invite',
      amount: 7000000,
      paymentDate: addDaysISO(now, -9),
      method: 'Transfer Bank',
      stage: 'DP / Uang Muka',
      referenceNumber: 'TRX-BCA-2026-01388',
      notes: 'DP produksi suvenir keramik 500 pcs',
      documentId: null,
      createdAt: nowISO,
    },
  ];

  const documents: DigitalDocument[] = [
    {
      id: 'doc_contract_venue',
      vendorId: 'v_venue',
      paymentId: null,
      title: 'Kontrak Kerjasama Ballroom & Katering 2027',
      kind: 'Kontrak Vendor',
      fileName: 'Kontrak_Grand_Pendopo.pdf',
      mimeType: 'application/pdf',
      fileSize: 1096,
      uploadedAt: nowISO,
      notes: 'Ditandatangani kedua belah pihak, klausul overtime Rp 5 jt/jam.',
    },
    {
      id: 'doc_receipt_venue',
      vendorId: 'v_venue',
      paymentId: 'pay_1',
      title: 'Bukti Transfer DP Ballroom (Rp 65 Juta)',
      kind: 'Bukti Pembayaran',
      fileName: 'Bukti_DP_Grand_Pendopo.svg',
      mimeType: 'image/svg+xml',
      fileSize: 1625,
      uploadedAt: nowISO,
      notes: 'Terverifikasi oleh Finance Grand Pendopo.',
    },
    {
      id: 'doc_contract_decor',
      vendorId: 'v_decor',
      paymentId: null,
      title: 'SPK & Rincian Bunga Atelier Floret',
      kind: 'Kontrak Vendor',
      fileName: 'SPK_Atelier_Floret.pdf',
      mimeType: 'application/pdf',
      fileSize: 1080,
      uploadedAt: nowISO,
      notes: 'Termasuk bongkar pasang H-1 pukul 22.00 WIB.',
    },
  ];

  const items: ShoppingItem[] = [
    {
      id: 'item_ring',
      name: 'Sepasang Cincin Kawin Emas Putih & Palladium',
      price: 8500000,
      quantity: 1,
      link: 'https://www.tokopedia.com/search?q=cincin+nikah+palladium+emas',
      category: 'KUA, Legal & Lainnya',
      purchased: true,
      notes: 'Ukuran 12 & 17, sudah termasuk ukir nama',
      createdAt: nowISO,
      updatedAt: nowISO,
    },
    {
      id: 'item_seserahan',
      name: 'Paket Box Seserahan Akrilik & Hias (8 Kotak)',
      price: 1650000,
      quantity: 1,
      link: 'https://shopee.co.id/search?keyword=kotak+seserahan+akrilik',
      category: 'Busana & Tata Rias',
      purchased: false,
      notes: 'Pesan minimal H-21 agar sempat dirangkai',
      createdAt: nowISO,
      updatedAt: nowISO,
    },
  ];

  const config: WeddingConfig = {
    coupleNames: 'Alya & Dimas',
    weddingDate: `${weddingDay}T09:00`,
    venueName: 'Grand Pendopo Nusantara',
    city: 'Jakarta Selatan',
    totalBudget: 350000000,
    reminderLeadDays: 7,
    browserAlertsEnabled: false,
    soundAlertsEnabled: true,
    categoryBudgets: {
      'Venue & Katering': 170000000,
      'Dekorasi & Pencahayaan': 60000000,
      'Dokumentasi (Foto & Video)': 32000000,
      'Busana & Tata Rias': 35000000,
      'Hiburan, MC & Audio': 18000000,
      'Undangan & Suvenir': 15000000,
      'Akomodasi & Transportasi': 12000000,
      'KUA, Legal & Lainnya': 8000000,
    },
  };

  return {
    config,
    vendors,
    payments,
    documents,
    items,
    lastUpdated: nowISO,
    hasUserEdits: false,
  };
}

function normalizeState(raw: Partial<WeddingAppState>): WeddingAppState {
  const base = createInitialLocalState();
  return {
    config: raw.config ? { ...base.config, ...raw.config } : base.config,
    vendors: Array.isArray(raw.vendors) ? raw.vendors : base.vendors,
    payments: Array.isArray(raw.payments) ? raw.payments : base.payments,
    documents: Array.isArray(raw.documents) ? raw.documents : base.documents,
    items: Array.isArray(raw.items) ? raw.items : base.items,
    lastUpdated: raw.lastUpdated || new Date().toISOString(),
    hasUserEdits: Boolean(raw.hasUserEdits),
  };
}

function recalculateVendorPaidAmount(state: WeddingAppState, vendorId: string): void {
  const vendor = state.vendors.find((v) => v.id === vendorId);
  if (!vendor) return;
  vendor.paidAmount = state.payments
    .filter((p) => p.vendorId === vendorId)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  vendor.updatedAt = new Date().toISOString();
}

/* ---------------- Public LocalStorage Operations ---------------- */
export function loadLocalState(): WeddingAppState {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WeddingAppState>;
      if (parsed && typeof parsed === 'object' && parsed.config && Array.isArray(parsed.vendors)) {
        return normalizeState(parsed);
      }
    }
  } catch {
    // Fall back to fresh initial state if JSON corrupted
  }

  const fresh = createInitialLocalState();
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function saveLocalState(state: WeddingAppState, markUserEdited = true): WeddingAppState {
  const next: WeddingAppState = {
    ...state,
    lastUpdated: new Date().toISOString(),
    hasUserEdits: markUserEdited ? true : state.hasUserEdits,
  };
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function updateLocalConfig(
  current: WeddingAppState,
  updated: Partial<WeddingConfig>
): WeddingAppState {
  const next: WeddingAppState = {
    ...current,
    config: {
      ...current.config,
      ...updated,
      totalBudget: Math.max(0, Number(updated.totalBudget ?? current.config.totalBudget)),
      reminderLeadDays: Math.max(
        1,
        Math.min(60, Number(updated.reminderLeadDays ?? current.config.reminderLeadDays))
      ),
    },
  };
  return saveLocalState(next);
}

export function addLocalVendor(
  current: WeddingAppState,
  payload: Partial<VendorItem>
): WeddingAppState {
  const nowISO = new Date().toISOString();
  const initialPaid = Math.max(0, Number(payload.paidAmount || 0));
  const vendorId = generateId('v');

  const newVendor: VendorItem = {
    id: vendorId,
    name: String(payload.name || 'Vendor Baru').trim(),
    category: (payload.category as VendorCategory) || 'KUA, Legal & Lainnya',
    picName: String(payload.picName || '-').trim(),
    picPhone: String(payload.picPhone || '-').trim(),
    serviceDescription: String(payload.serviceDescription || '').trim(),
    estimatedPrice: Math.max(0, Number(payload.estimatedPrice || 0)),
    contractPrice: Math.max(0, Number(payload.contractPrice || 0)),
    paidAmount: initialPaid,
    dueDate: String(payload.dueDate || ''),
    eventDate: String(payload.eventDate || ''),
    eventLabel: String(payload.eventLabel || 'Jadwal Vendor'),
    notes: String(payload.notes || ''),
    calendarEventId: null,
    calendarSyncedAt: null,
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  const nextPayments = [...current.payments];
  if (initialPaid > 0) {
    nextPayments.unshift({
      id: generateId('pay'),
      vendorId,
      amount: initialPaid,
      paymentDate: nowISO.split('T')[0],
      method: 'Transfer Bank',
      stage:
        initialPaid >= (newVendor.contractPrice || newVendor.estimatedPrice)
          ? 'Pelunasan'
          : 'DP / Uang Muka',
      referenceNumber: 'SALDO-AWAL',
      notes: 'Pembayaran awal saat pendaftaran vendor',
      documentId: null,
      createdAt: nowISO,
    });
  }

  return saveLocalState({
    ...current,
    vendors: [...current.vendors, newVendor],
    payments: nextPayments,
  });
}

export function updateLocalVendor(
  current: WeddingAppState,
  id: string,
  payload: Partial<VendorItem>
): WeddingAppState {
  const vendors = current.vendors.map((v) =>
    v.id === id
      ? {
          ...v,
          name: String(payload.name ?? v.name).trim(),
          category: (payload.category as VendorCategory) ?? v.category,
          picName: String(payload.picName ?? v.picName).trim(),
          picPhone: String(payload.picPhone ?? v.picPhone).trim(),
          serviceDescription: String(payload.serviceDescription ?? v.serviceDescription).trim(),
          estimatedPrice: Math.max(0, Number(payload.estimatedPrice ?? v.estimatedPrice)),
          contractPrice: Math.max(0, Number(payload.contractPrice ?? v.contractPrice)),
          dueDate: String(payload.dueDate ?? v.dueDate),
          eventDate: String(payload.eventDate ?? v.eventDate),
          eventLabel: String(payload.eventLabel ?? v.eventLabel),
          notes: String(payload.notes ?? v.notes),
          updatedAt: new Date().toISOString(),
        }
      : v
  );

  return saveLocalState({ ...current, vendors });
}

export function updateLocalVendorCalendar(
  current: WeddingAppState,
  id: string,
  calendarEventId: string | null
): WeddingAppState {
  const vendors = current.vendors.map((v) =>
    v.id === id
      ? {
          ...v,
          calendarEventId,
          calendarSyncedAt: calendarEventId ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        }
      : v
  );
  return saveLocalState({ ...current, vendors });
}

export async function deleteLocalVendor(
  current: WeddingAppState,
  vendorId: string
): Promise<WeddingAppState> {
  const docsToRemove = current.documents.filter((d) => d.vendorId === vendorId);
  for (const doc of docsToRemove) {
    await deleteLocalFile(doc.id);
  }

  return saveLocalState({
    ...current,
    vendors: current.vendors.filter((v) => v.id !== vendorId),
    payments: current.payments.filter((p) => p.vendorId !== vendorId),
    documents: current.documents.filter((d) => d.vendorId !== vendorId),
  });
}

export async function recordLocalPayment(
  current: WeddingAppState,
  payload: {
    vendorId: string;
    amount: number;
    paymentDate: string;
    method: PaymentRecord['method'];
    stage: PaymentRecord['stage'];
    referenceNumber: string;
    notes: string;
    receiptFile?: { fileName: string; mimeType: string; base64Data: string } | null;
  }
): Promise<WeddingAppState> {
  const vendor = current.vendors.find((v) => v.id === payload.vendorId);
  if (!vendor) throw new Error('Vendor tidak ditemukan');

  const nowISO = new Date().toISOString();
  const paymentId = generateId('pay');
  let documentId: string | null = null;
  const nextDocuments = [...current.documents];

  if (payload.receiptFile?.base64Data && payload.receiptFile?.fileName) {
    const docId = generateId('doc');
    const safeName = payload.receiptFile.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const mimeType = payload.receiptFile.mimeType || 'application/octet-stream';
    const dataUrl = payload.receiptFile.base64Data.startsWith('data:')
      ? payload.receiptFile.base64Data
      : `data:${mimeType};base64,${payload.receiptFile.base64Data}`;

    const base64Body = dataUrl.split(',')[1] || '';
    const approxBytes = Math.floor((base64Body.length * 3) / 4);

    await saveLocalFile({
      id: docId,
      fileName: safeName,
      mimeType,
      dataUrl,
    });

    nextDocuments.unshift({
      id: docId,
      vendorId: vendor.id,
      paymentId,
      title: `Bukti ${payload.stage} - ${vendor.name}`,
      kind: 'Bukti Pembayaran',
      fileName: safeName,
      mimeType,
      fileSize: approxBytes,
      uploadedAt: nowISO,
      notes: payload.notes || `Referensi: ${payload.referenceNumber || '-'}`,
    });
    documentId = docId;
  }

  const newPayment: PaymentRecord = {
    id: paymentId,
    vendorId: vendor.id,
    amount: Math.max(1, Number(payload.amount)),
    paymentDate: payload.paymentDate || nowISO.split('T')[0],
    method: payload.method || 'Transfer Bank',
    stage: payload.stage || 'Termin / Cicilan',
    referenceNumber: payload.referenceNumber || '-',
    notes: payload.notes || '',
    documentId,
    createdAt: nowISO,
  };

  const nextState: WeddingAppState = {
    ...current,
    vendors: current.vendors.map((v) => ({ ...v })),
    payments: [newPayment, ...current.payments],
    documents: nextDocuments,
  };
  recalculateVendorPaidAmount(nextState, vendor.id);
  return saveLocalState(nextState);
}

export async function uploadLocalDocument(
  current: WeddingAppState,
  payload: {
    vendorId: string;
    title: string;
    kind: DocumentKind;
    fileName: string;
    mimeType: string;
    base64Data: string;
    notes: string;
  }
): Promise<WeddingAppState> {
  const docId = generateId('doc');
  const safeName = payload.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const mimeType = payload.mimeType || 'application/octet-stream';
  const dataUrl = payload.base64Data.startsWith('data:')
    ? payload.base64Data
    : `data:${mimeType};base64,${payload.base64Data}`;

  const base64Body = dataUrl.split(',')[1] || '';
  const approxBytes = Math.floor((base64Body.length * 3) / 4);

  await saveLocalFile({
    id: docId,
    fileName: safeName,
    mimeType,
    dataUrl,
  });

  const newDoc: DigitalDocument = {
    id: docId,
    vendorId: payload.vendorId || '',
    paymentId: null,
    title: (payload.title || safeName).trim(),
    kind: payload.kind || 'Kontrak Vendor',
    fileName: safeName,
    mimeType,
    fileSize: approxBytes,
    uploadedAt: new Date().toISOString(),
    notes: payload.notes || '',
  };

  return saveLocalState({
    ...current,
    documents: [newDoc, ...current.documents],
  });
}

export async function deleteLocalDocument(
  current: WeddingAppState,
  docId: string
): Promise<WeddingAppState> {
  await deleteLocalFile(docId);
  return saveLocalState({
    ...current,
    documents: current.documents.filter((d) => d.id !== docId),
    payments: current.payments.map((p) => (p.documentId === docId ? { ...p, documentId: null } : p)),
  });
}

export function addLocalItem(
  current: WeddingAppState,
  payload: {
    name: string;
    price: number;
    quantity: number;
    link: string;
    category: VendorCategory;
    purchased: boolean;
    notes: string;
  }
): WeddingAppState {
  const nowISO = new Date().toISOString();
  const newItem: ShoppingItem = {
    id: generateId('item'),
    name: String(payload.name || 'Barang Baru').trim(),
    price: Math.max(0, Number(payload.price || 0)),
    quantity: Math.max(1, Number(payload.quantity || 1)),
    link: String(payload.link || '').trim(),
    category: payload.category || 'KUA, Legal & Lainnya',
    purchased: Boolean(payload.purchased),
    notes: String(payload.notes || '').trim(),
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  return saveLocalState({
    ...current,
    items: [newItem, ...(current.items || [])],
  });
}

export function updateLocalItem(
  current: WeddingAppState,
  id: string,
  payload: Partial<ShoppingItem>
): WeddingAppState {
  const items = (current.items || []).map((item) =>
    item.id === id
      ? {
          ...item,
          name: String(payload.name ?? item.name).trim(),
          price: Math.max(0, Number(payload.price ?? item.price)),
          quantity: Math.max(1, Number(payload.quantity ?? item.quantity)),
          link: String(payload.link ?? item.link).trim(),
          category: (payload.category as VendorCategory) ?? item.category,
          purchased:
            payload.purchased !== undefined ? Boolean(payload.purchased) : item.purchased,
          notes: String(payload.notes ?? item.notes).trim(),
          updatedAt: new Date().toISOString(),
        }
      : item
  );

  return saveLocalState({ ...current, items });
}

export function deleteLocalItem(current: WeddingAppState, id: string): WeddingAppState {
  return saveLocalState({
    ...current,
    items: (current.items || []).filter((item) => item.id !== id),
  });
}

export function restoreLocalState(incoming: Partial<WeddingAppState>): WeddingAppState {
  const normalized = normalizeState({
    ...incoming,
    hasUserEdits: true,
  });
  return saveLocalState(normalized, true);
}
