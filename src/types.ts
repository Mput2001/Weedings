export type VendorCategory =
  | 'Venue & Katering'
  | 'Dekorasi & Pencahayaan'
  | 'Dokumentasi (Foto & Video)'
  | 'Busana & Tata Rias'
  | 'Hiburan, MC & Audio'
  | 'Undangan & Suvenir'
  | 'Akomodasi & Transportasi'
  | 'KUA, Legal & Lainnya';

export const VENDOR_CATEGORIES: VendorCategory[] = [
  'Venue & Katering',
  'Dekorasi & Pencahayaan',
  'Dokumentasi (Foto & Video)',
  'Busana & Tata Rias',
  'Hiburan, MC & Audio',
  'Undangan & Suvenir',
  'Akomodasi & Transportasi',
  'KUA, Legal & Lainnya',
];

export type PaymentStatus = 'Belum Bayar' | 'DP Terbayar' | 'Cicilan' | 'Lunas' | 'Terlambat';

export type DocumentKind = 'Kontrak Vendor' | 'Bukti Pembayaran' | 'Invoice' | 'Proposal / Penawaran';

export interface WeddingConfig {
  coupleNames: string;
  weddingDate: string; // ISO YYYY-MM-DDTHH:mm
  venueName: string;
  city: string;
  totalBudget: number;
  reminderLeadDays: number;
  browserAlertsEnabled: boolean;
  soundAlertsEnabled: boolean;
  categoryBudgets: Record<VendorCategory, number>;
}

export interface VendorItem {
  id: string;
  name: string;
  category: VendorCategory;
  picName: string;
  picPhone: string;
  serviceDescription: string;
  estimatedPrice: number;
  contractPrice: number;
  paidAmount: number;
  dueDate: string; // YYYY-MM-DD
  eventDate: string; // YYYY-MM-DD (e.g. Fitting / Technical Meeting / Pelunasan)
  eventLabel: string;
  notes: string;
  calendarEventId?: string | null;
  calendarSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  vendorId: string;
  amount: number;
  paymentDate: string; // YYYY-MM-DD
  method: 'Transfer Bank' | 'Virtual Account' | 'QRIS' | 'Kartu Kredit' | 'Tunai';
  stage: 'Booking Fee' | 'DP / Uang Muka' | 'Termin / Cicilan' | 'Pelunasan';
  referenceNumber: string;
  notes: string;
  documentId?: string | null;
  createdAt: string;
}

export interface DigitalDocument {
  id: string;
  vendorId: string;
  paymentId?: string | null;
  title: string;
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  notes?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  link: string;
  category: VendorCategory;
  purchased: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeddingAppState {
  config: WeddingConfig;
  vendors: VendorItem[];
  payments: PaymentRecord[];
  documents: DigitalDocument[];
  items: ShoppingItem[];
  lastUpdated: string;
  hasUserEdits?: boolean;
}

export type AlertSeverity = 'overdue' | 'due_today' | 'upcoming';

export interface BillAlert {
  id: string;
  vendorId: string;
  vendorName: string;
  category: VendorCategory;
  dueDate: string;
  daysDelta: number; // negative = overdue, 0 = today, positive = days left
  remainingAmount: number;
  severity: AlertSeverity;
  picPhone: string;
}
