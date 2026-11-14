import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { WeddingAppState } from '../types';
import { formatDateID, formatFileSize, formatIDR, getVendorRemaining, getVendorStatus } from './formatters';

export function exportAuditPDF(state: WeddingAppState): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { config, vendors, payments, documents, items = [] } = state;

  const totalVendorPaid = vendors.reduce((s, v) => s + v.paidAmount, 0);
  const totalItemsCost = items.reduce((s, it) => s + it.price * (it.quantity || 1), 0);
  const totalItemsPaid = items
    .filter((it) => it.purchased)
    .reduce((s, it) => s + it.price * (it.quantity || 1), 0);
  const totalUangKeluar = totalVendorPaid + totalItemsPaid;
  const totalVendorRemaining = vendors.reduce((s, v) => s + getVendorRemaining(v), 0);
  const totalItemsRemaining = totalItemsCost - totalItemsPaid;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN AUDIT ANGGARAN & VENDOR PERNIKAHAN', 14, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${config.coupleNames}  |  Hari-H: ${formatDateID(config.weddingDate)}  |  ${config.venueName}, ${config.city}`, 14, 21);
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Dicetak untuk Audit Internal pada: ${new Date().toLocaleString('id-ID')}`, 14, 27);

  // Executive Summary Table
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Ringkasan Eksekutif Keuangan', 14, 41);

  autoTable(doc, {
    startY: 44,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } },
    head: [['Indikator Keuangan', 'Nilai (IDR)']],
    body: [
      ['Total Uang Keluar (Vendor Lunas/Terbayar + Barang Terbeli)', formatIDR(totalUangKeluar)],
      ['Uang Keluar — Vendor', formatIDR(totalVendorPaid)],
      ['Uang Keluar — List Barang (Sudah Dibeli)', formatIDR(totalItemsPaid)],
      ['Sisa Tagihan Vendor Belum Lunas', formatIDR(totalVendorRemaining)],
      ['Estimasi Barang Belum Dibeli', formatIDR(totalItemsRemaining)],
    ],
  });

  // Vendor Breakdown Table
  const afterSummaryY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Daftar Rincian Harga & Status Tagihan Vendor', 14, afterSummaryY + 10);

  autoTable(doc, {
    startY: afterSummaryY + 13,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8, textColor: [30, 41, 59] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    head: [['Vendor', 'Kategori', 'Jatuh Tempo', 'Kontrak', 'Terbayar', 'Sisa', 'Status', 'Dok']],
    body: vendors.map((v) => {
      const docCount = documents.filter((d) => d.vendorId === v.id).length;
      const eff = v.contractPrice > 0 ? v.contractPrice : v.estimatedPrice;
      return [
        v.name,
        v.category,
        formatDateID(v.dueDate),
        formatIDR(eff),
        formatIDR(v.paidAmount),
        formatIDR(getVendorRemaining(v)),
        getVendorStatus(v),
        `${docCount} file`,
      ];
    }),
  });

  // Payment Ledger Table
  const afterVendorY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 180;
  if (afterVendorY > 235) {
    doc.addPage();
  }
  const paymentHeaderY = afterVendorY > 235 ? 18 : afterVendorY + 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Log Transaksi Pembayaran & Bukti Audit', 14, paymentHeaderY);

  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));
  const docMap = new Map(documents.map((d) => [d.id, d.title]));

  autoTable(doc, {
    startY: paymentHeaderY + 3,
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8, textColor: [30, 41, 59] },
    columnStyles: { 4: { halign: 'right' } },
    head: [['Tanggal', 'Vendor', 'Tahap', 'Metode / Ref', 'Nominal', 'Bukti Digital']],
    body: payments.length
      ? payments.map((p) => [
          formatDateID(p.paymentDate),
          vendorMap.get(p.vendorId) || 'Vendor Dihapus',
          p.stage,
          `${p.method}${p.referenceNumber ? ` (${p.referenceNumber})` : ''}`,
          formatIDR(p.amount),
          p.documentId ? docMap.get(p.documentId) || 'Terlampir' : 'Belum diunggah',
        ])
      : [['-', 'Belum ada transaksi pembayaran tercatat', '-', '-', '-', '-']],
  });

  // Digital Document Inventory
  const afterPaymentsY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 220;
  if (afterPaymentsY > 240) {
    doc.addPage();
  }
  const docHeaderY = afterPaymentsY > 240 ? 18 : afterPaymentsY + 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Arsip Dokumen Digital (Kontrak & Bukti Bayar)', 14, docHeaderY);

  autoTable(doc, {
    startY: docHeaderY + 3,
    theme: 'striped',
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8, textColor: [30, 41, 59] },
    head: [['Judul Dokumen', 'Jenis', 'Vendor Terkait', 'Nama File', 'Ukuran', 'Penyimpanan']],
    body: documents.length
      ? documents.map((d) => [
          d.title,
          d.kind,
          vendorMap.get(d.vendorId) || '-',
          d.fileName,
          formatFileSize(d.fileSize),
          'LocalStorage Browser',
        ])
      : [['-', 'Belum ada dokumen digital terunggah', '-', '-', '-', '-']],
  });

  // Shopping List Inventory
  const afterDocsY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 220;
  if (afterDocsY > 240) {
    doc.addPage();
  }
  const itemsHeaderY = afterDocsY > 240 ? 18 : afterDocsY + 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Daftar Belanja Barang, Harga & Link', 14, itemsHeaderY);

  autoTable(doc, {
    startY: itemsHeaderY + 3,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.6, textColor: [30, 41, 59] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
    head: [['Nama Barang', 'Kategori', 'Qty', 'Total Harga', 'Status', 'Link Pembelian']],
    body: items.length
      ? items.map((it) => [
          it.name,
          it.category,
          String(it.quantity || 1),
          formatIDR(it.price * (it.quantity || 1)),
          it.purchased ? 'Sudah Dibeli' : 'Belum Dibeli',
          it.link || '-',
        ])
      : [['-', 'Belum ada daftar barang tercatat', '-', '-', '-', '-']],
  });

  const safeCouple = config.coupleNames.replace(/[^a-zA-Z0-9]+/g, '_');
  const fileName = `Laporan_Audit_Pernikahan_${safeCouple}.pdf`;
  doc.save(fileName);
  return fileName;
}

export function exportAuditExcel(state: WeddingAppState): string {
  const { config, vendors, payments, documents, items = [] } = state;
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));
  const docMap = new Map(documents.map((d) => [d.id, d]));

  const totalVendorPaid = vendors.reduce((s, v) => s + v.paidAmount, 0);
  const totalItemsCost = items.reduce((s, it) => s + it.price * (it.quantity || 1), 0);
  const totalItemsPaid = items
    .filter((it) => it.purchased)
    .reduce((s, it) => s + it.price * (it.quantity || 1), 0);
  const totalUangKeluar = totalVendorPaid + totalItemsPaid;
  const totalVendorRemaining = vendors.reduce((s, v) => s + getVendorRemaining(v), 0);
  const totalItemsRemaining = totalItemsCost - totalItemsPaid;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Ringkasan Eksekutif
  const summaryRows = [
    ['LAPORAN AUDIT INTERNAL KEUANGAN PERNIKAHAN', ''],
    ['Pasangan', config.coupleNames],
    ['Tanggal & Waktu Hari-H', formatDateID(config.weddingDate)],
    ['Lokasi / Kota', `${config.venueName}, ${config.city}`],
    ['Tanggal Ekspor Audit', new Date().toLocaleString('id-ID')],
    ['', ''],
    ['METRIK KEUANGAN', 'NILAI (IDR)'],
    ['Total Uang Keluar (Vendor + List Barang)', totalUangKeluar],
    ['Uang Keluar — Vendor (Lunas & Terbayar)', totalVendorPaid],
    ['Uang Keluar — List Barang (Sudah Dibeli)', totalItemsPaid],
    ['Sisa Tagihan Vendor Belum Lunas', totalVendorRemaining],
    ['Daftar Barang Belum Dibeli', totalItemsRemaining],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 42 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan_Eksekutif');

  // Sheet 2: Daftar Vendor & Harga
  const vendorRows = vendors.map((v, idx) => {
    const effective = v.contractPrice > 0 ? v.contractPrice : v.estimatedPrice;
    const docsCount = documents.filter((d) => d.vendorId === v.id).length;
    return {
      No: idx + 1,
      'Nama Vendor': v.name,
      Kategori: v.category,
      PIC: v.picName,
      'Telepon PIC': v.picPhone,
      'Deskripsi Layanan': v.serviceDescription,
      'Estimasi Harga (IDR)': v.estimatedPrice,
      'Harga Kontrak (IDR)': v.contractPrice,
      'Sudah Dibayar (IDR)': v.paidAmount,
      'Sisa Tagihan (IDR)': getVendorRemaining(v),
      'Persentase Terbayar (%)': effective > 0 ? Number(((v.paidAmount / effective) * 100).toFixed(1)) : 0,
      'Status Pembayaran': getVendorStatus(v),
      'Jatuh Tempo Tagihan': v.dueDate,
      'Jadwal Kalender': `${v.eventDate} (${v.eventLabel})`,
      'Sinkron Google Calendar': v.calendarEventId ? 'Ya' : 'Belum',
      'Jumlah Dokumen': docsCount,
      Catatan: v.notes,
    };
  });
  const wsVendors = XLSX.utils.json_to_sheet(vendorRows);
  wsVendors['!cols'] = [
    { wch: 5 },
    { wch: 28 },
    { wch: 24 },
    { wch: 18 },
    { wch: 16 },
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 26 },
    { wch: 16 },
    { wch: 12 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsVendors, 'Daftar_Vendor_Harga');

  // Sheet 3: Riwayat Pembayaran
  const paymentRows = payments.map((p, idx) => ({
    No: idx + 1,
    'Tanggal Bayar': p.paymentDate,
    'Nama Vendor': vendorMap.get(p.vendorId)?.name || 'Vendor Dihapus',
    Kategori: vendorMap.get(p.vendorId)?.category || '-',
    Tahap: p.stage,
    'Metode Pembayaran': p.method,
    'Nomor Referensi': p.referenceNumber || '-',
    'Nominal (IDR)': p.amount,
    'Bukti Digital Terlampir': p.documentId ? docMap.get(p.documentId)?.fileName || 'Ada' : 'Belum Ada',
    Catatan: p.notes || '-',
  }));
  const wsPayments = XLSX.utils.json_to_sheet(
    paymentRows.length
      ? paymentRows
      : [{ No: 0, 'Tanggal Bayar': '-', 'Nama Vendor': 'Belum ada transaksi', Kategori: '-', Tahap: '-', 'Metode Pembayaran': '-', 'Nomor Referensi': '-', 'Nominal (IDR)': 0, 'Bukti Digital Terlampir': '-', Catatan: '-' }]
  );
  wsPayments['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 26 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
    { wch: 26 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Riwayat_Pembayaran');

  // Sheet 4: Arsip Dokumen Digital
  const docRows = documents.map((d, idx) => ({
    No: idx + 1,
    'Judul Dokumen': d.title,
    'Jenis Dokumen': d.kind,
    'Vendor Terkait': vendorMap.get(d.vendorId)?.name || '-',
    'Nama File': d.fileName,
    'Tipe MIME': d.mimeType,
    'Ukuran (Bytes)': d.fileSize,
    'Waktu Unggah': d.uploadedAt,
    Penyimpanan: 'LocalStorage Browser',
  }));
  const wsDocs = XLSX.utils.json_to_sheet(
    docRows.length
      ? docRows
      : [{ No: 0, 'Judul Dokumen': 'Belum ada dokumen', 'Jenis Dokumen': '-', 'Vendor Terkait': '-', 'Nama File': '-', 'Tipe MIME': '-', 'Ukuran (Bytes)': 0, 'Waktu Unggah': '-', Penyimpanan: '-' }]
  );
  wsDocs['!cols'] = [
    { wch: 5 },
    { wch: 28 },
    { wch: 20 },
    { wch: 24 },
    { wch: 26 },
    { wch: 22 },
    { wch: 14 },
    { wch: 22 },
    { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDocs, 'Arsip_Dokumen_Digital');

  // Sheet 5: Daftar Barang & Link
  const itemRows = items.map((it, idx) => ({
    No: idx + 1,
    'Nama Barang': it.name,
    Kategori: it.category,
    'Harga Satuan (IDR)': it.price,
    Jumlah: it.quantity || 1,
    'Total Harga (IDR)': it.price * (it.quantity || 1),
    'Status Beli': it.purchased ? 'Sudah Dibeli' : 'Belum Dibeli',
    'Link Produk / Toko': it.link || '-',
    Catatan: it.notes || '-',
  }));
  const wsItems = XLSX.utils.json_to_sheet(
    itemRows.length
      ? itemRows
      : [{ No: 0, 'Nama Barang': 'Belum ada barang', Kategori: '-', 'Harga Satuan (IDR)': 0, Jumlah: 0, 'Total Harga (IDR)': 0, 'Status Beli': '-', 'Link Produk / Toko': '-', Catatan: '-' }]
  );
  wsItems['!cols'] = [
    { wch: 5 },
    { wch: 32 },
    { wch: 22 },
    { wch: 18 },
    { wch: 10 },
    { wch: 18 },
    { wch: 16 },
    { wch: 42 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Daftar_Barang_Link');

  const safeCouple = config.coupleNames.replace(/[^a-zA-Z0-9]+/g, '_');
  const fileName = `Audit_Keuangan_Pernikahan_${safeCouple}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
