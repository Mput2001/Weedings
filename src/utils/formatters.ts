import { BillAlert, PaymentStatus, VendorItem, WeddingConfig } from '../types';

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatCompactIDR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2).replace(/\.00$/, '')} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')} Jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
  }
  return formatIDR(amount);
}

export function formatDateID(dateStr: string): string {
  if (!dateStr) return '-';
  const parsed = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function formatDateTimeID(dateStr: string): string {
  if (!dateStr) return '-';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function getDaysDeltaFromToday(dateStr: string): number {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

export function getVendorStatus(vendor: VendorItem): PaymentStatus {
  const total = vendor.contractPrice > 0 ? vendor.contractPrice : vendor.estimatedPrice;
  const remaining = Math.max(0, total - vendor.paidAmount);
  if (total > 0 && remaining === 0) return 'Lunas';
  const delta = getDaysDeltaFromToday(vendor.dueDate);
  if (remaining > 0 && delta < 0) return 'Terlambat';
  if (vendor.paidAmount > 0 && remaining > 0) {
    return vendor.paidAmount >= total * 0.5 ? 'Cicilan' : 'DP Terbayar';
  }
  return 'Belum Bayar';
}

export function getVendorRemaining(vendor: VendorItem): number {
  const effectiveTotal = vendor.contractPrice > 0 ? vendor.contractPrice : vendor.estimatedPrice;
  return Math.max(0, effectiveTotal - vendor.paidAmount);
}

export function computeBillAlerts(vendors: VendorItem[], leadDays: number): BillAlert[] {
  const alerts: BillAlert[] = [];
  for (const v of vendors) {
    const remaining = getVendorRemaining(v);
    if (remaining <= 0 || !v.dueDate) continue;
    const daysDelta = getDaysDeltaFromToday(v.dueDate);
    if (daysDelta < 0) {
      alerts.push({
        id: `alert-${v.id}`,
        vendorId: v.id,
        vendorName: v.name,
        category: v.category,
        dueDate: v.dueDate,
        daysDelta,
        remainingAmount: remaining,
        severity: 'overdue',
        picPhone: v.picPhone,
      });
    } else if (daysDelta === 0) {
      alerts.push({
        id: `alert-${v.id}`,
        vendorId: v.id,
        vendorName: v.name,
        category: v.category,
        dueDate: v.dueDate,
        daysDelta,
        remainingAmount: remaining,
        severity: 'due_today',
        picPhone: v.picPhone,
      });
    } else if (daysDelta <= leadDays) {
      alerts.push({
        id: `alert-${v.id}`,
        vendorId: v.id,
        vendorName: v.name,
        category: v.category,
        dueDate: v.dueDate,
        daysDelta,
        remainingAmount: remaining,
        severity: 'upcoming',
        picPhone: v.picPhone,
      });
    }
  }
  return alerts.sort((a, b) => a.daysDelta - b.daysDelta);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeICS(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function toICSDate(dateStr: string): string {
  const clean = dateStr.split('T')[0].replace(/-/g, '');
  return clean;
}

export function generateICS(vendors: VendorItem[], config: WeddingConfig): string {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RencanaNikah//Wedding Planner ID//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  // Wedding Day main event
  const weddingDay = toICSDate(config.weddingDate);
  lines.push(
    'BEGIN:VEVENT',
    `UID:wedding-day-${weddingDay}@rencananikah.app`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART;VALUE=DATE:${weddingDay}`,
    `SUMMARY:${escapeICS(`Hari Pernikahan: ${config.coupleNames}`)}`,
    `LOCATION:${escapeICS(`${config.venueName}, ${config.city}`)}`,
    `DESCRIPTION:${escapeICS(`Hari-H Pernikahan ${config.coupleNames}. Total Anggaran: ${formatIDR(config.totalBudget)}`)}`,
    'END:VEVENT'
  );

  for (const v of vendors) {
    const remaining = getVendorRemaining(v);
    if (v.dueDate && remaining > 0) {
      const due = toICSDate(v.dueDate);
      lines.push(
        'BEGIN:VEVENT',
        `UID:due-${v.id}@rencananikah.app`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;VALUE=DATE:${due}`,
        `SUMMARY:${escapeICS(`Tagihan Vendor: ${v.name} (${formatIDR(remaining)})`)}`,
        `DESCRIPTION:${escapeICS(`Kategori: ${v.category}\\nPIC: ${v.picName} (${v.picPhone})\\nSisa Tagihan: ${formatIDR(remaining)}\\nCatatan: ${v.notes}`)}`,
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeICS(`Pengingat pembayaran ${v.name}`)}`,
        'END:VALARM',
        'END:VEVENT'
      );
    }

    if (v.eventDate) {
      const ev = toICSDate(v.eventDate);
      lines.push(
        'BEGIN:VEVENT',
        `UID:event-${v.id}@rencananikah.app`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;VALUE=DATE:${ev}`,
        `SUMMARY:${escapeICS(`${v.eventLabel || 'Jadwal Vendor'}: ${v.name}`)}`,
        `DESCRIPTION:${escapeICS(`${v.serviceDescription}\\nPIC: ${v.picName} (${v.picPhone})`)}`,
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
