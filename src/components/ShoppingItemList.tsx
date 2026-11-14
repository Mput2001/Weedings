import { useMemo, useState } from 'react';
import {
  Check,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { ShoppingItem, VENDOR_CATEGORIES, VendorCategory } from '../types';
import { formatIDR } from '../utils/formatters';

interface ShoppingItemListProps {
  items: ShoppingItem[];
  onAddItem: (payload: {
    name: string;
    price: number;
    quantity: number;
    link: string;
    category: VendorCategory;
    purchased: boolean;
    notes: string;
  }) => Promise<void>;
  onUpdateItem: (id: string, payload: Partial<ShoppingItem>) => Promise<void>;
  onDeleteItem: (item: ShoppingItem) => void;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getHostname(raw: string): string {
  if (!raw) return '';
  try {
    const u = new URL(normalizeUrl(raw));
    return u.hostname.replace(/^www\./, '');
  } catch {
    return raw;
  }
}

export function ShoppingItemList({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: ShoppingItemListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Belum Dibeli' | 'Sudah Dibeli'>('Semua');

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newQty, setNewQty] = useState<number>(1);
  const [newLink, setNewLink] = useState('');
  const [newCategory, setNewCategory] = useState<VendorCategory>('KUA, Legal & Lainnya');
  const [newPurchased, setNewPurchased] = useState(false);
  const [newNotes, setNewNotes] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editQty, setEditQty] = useState(1);
  const [editLink, setEditLink] = useState('');
  const [editCategory, setEditCategory] = useState<VendorCategory>('KUA, Legal & Lainnya');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleTogglePurchased = async (item: ShoppingItem) => {
    if (togglingId === item.id) return;
    setTogglingId(item.id);
    try {
      await onUpdateItem(item.id, { purchased: !item.purchased });
    } catch {
      // Error toast displayed by parent handler
    } finally {
      setTogglingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const matchesSearch =
        !q ||
        it.name.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        it.link.toLowerCase().includes(q) ||
        it.notes.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'Semua' ||
        (statusFilter === 'Sudah Dibeli' && it.purchased) ||
        (statusFilter === 'Belum Dibeli' && !it.purchased);
      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        const lineTotal = it.price * (it.quantity || 1);
        acc.total += lineTotal;
        if (it.purchased) acc.purchased += lineTotal;
        else acc.pending += lineTotal;
        return acc;
      },
      { total: 0, purchased: 0, pending: 0 }
    );
  }, [items]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSavingNew(true);
    try {
      await onAddItem({
        name: newName.trim(),
        price: Math.max(0, Number(newPrice)),
        quantity: Math.max(1, Number(newQty)),
        link: newLink.trim(),
        category: newCategory,
        purchased: newPurchased,
        notes: newNotes.trim(),
      });
      setNewName('');
      setNewPrice(0);
      setNewQty(1);
      setNewLink('');
      setNewNotes('');
      setNewPurchased(false);
      setShowAddForm(false);
    } finally {
      setSavingNew(false);
    }
  };

  const startEdit = (item: ShoppingItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.price);
    setEditQty(item.quantity || 1);
    setEditLink(item.link);
    setEditCategory(item.category);
    setEditNotes(item.notes);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await onUpdateItem(id, {
        name: editName.trim(),
        price: Math.max(0, Number(editPrice)),
        quantity: Math.max(1, Number(editQty)),
        link: editLink.trim(),
        category: editCategory,
        notes: editNotes.trim(),
      });
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            List Barang Perlengkapan, Harga & Link Toko
          </h3>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Total {items.length} barang ({formatIDR(totals.total)}) · Sudah dibeli{' '}
            <strong className="text-teal-700 font-mono">{formatIDR(totals.purchased)}</strong> · Belum dibeli{' '}
            <strong className="text-amber-700 font-mono">{formatIDR(totals.pending)}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Tutup Form Tambah' : 'Tambah Barang & Link'}
        </button>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-semibold text-slate-900">
              Tambah Barang Belanja Baru
            </h4>
            <span className="text-xs text-slate-500">
              Otomatis masuk ke pelacakan total anggaran pernikahan
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Barang
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Misal: Cincin Kawin, Kotak Seserahan, Sepatu Akad"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Harga Satuan (IDR)
              </label>
              <input
                type="number"
                min={0}
                required
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Qty
              </label>
              <input
                type="number"
                min={1}
                required
                value={newQty}
                onChange={(e) => setNewQty(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kategori Anggaran
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as VendorCategory)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              >
                {VENDOR_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-6">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Link Produk / Marketplace / Toko
              </label>
              <input
                type="text"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="https://tokopedia.com/... atau https://shopee.co.id/..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Catatan (Ukuran / Warna / Keterangan)
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Opsional..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPurchased}
                  onChange={(e) => setNewPurchased(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                Sudah Dibeli
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingNew}
              className="px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {savingNew ? 'Menyimpan...' : 'Simpan Barang'}
            </button>
          </div>
        </form>
      )}

      {/* Filter & List Table */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama barang, kategori, atau link..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(['Semua', 'Belum Dibeli', 'Sudah Dibeli'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab
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
          {filteredItems.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">
                Belum ada barang pada daftar ini.
              </p>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-700 text-white rounded-lg hover:bg-teal-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Barang Pertama
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 pl-5 pr-3">Status</th>
                  <th className="py-3 px-3">Nama Barang & Catatan</th>
                  <th className="py-3 px-3 text-right">Harga</th>
                  <th className="py-3 px-3">Link Pembelian</th>
                  <th className="py-3 pr-5 pl-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredItems.map((item) => {
                  const isEditing = editingId === item.id;
                  const totalLine = item.price * (item.quantity || 1);
                  const safeHref = normalizeUrl(item.link);

                  if (isEditing) {
                    return (
                      <tr key={item.id} className="bg-teal-50/30">
                        <td className="py-3 pl-5 pr-3 align-top text-xs text-slate-500">
                          Edit
                        </td>
                        <td className="py-3 px-3 align-top space-y-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-medium"
                            placeholder="Nama barang"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value as VendorCategory)}
                              className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md"
                            >
                              {VENDOR_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md"
                              placeholder="Catatan..."
                            />
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top space-y-2">
                          <input
                            type="number"
                            min={0}
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="w-32 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono text-right"
                          />
                          <input
                            type="number"
                            min={1}
                            value={editQty}
                            onChange={(e) => setEditQty(Number(e.target.value))}
                            className="w-20 ml-auto block px-2 py-1 text-xs bg-white border border-slate-300 rounded-md font-mono text-right"
                            title="Jumlah"
                          />
                        </td>
                        <td className="py-3 px-3 align-top">
                          <input
                            type="text"
                            value={editLink}
                            onChange={(e) => setEditLink(e.target.value)}
                            className="w-full min-w-[180px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono"
                            placeholder="https://..."
                          />
                        </td>
                        <td className="py-3 pr-5 pl-3 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item.id)}
                              disabled={savingEdit}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-teal-700 text-white rounded-md hover:bg-teal-800 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
                              aria-label="Batal edit"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 pl-5 pr-3 align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleTogglePurchased(item)}
                          disabled={togglingId === item.id}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50 cursor-pointer ${
                            item.purchased ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.purchased}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-teal-700 pointer-events-none"
                          />
                          {item.purchased ? 'Sudah Dibeli' : 'Belum Dibeli'}
                        </button>
                      </td>

                      <td className="py-3.5 px-3 align-top">
                        <div
                          className={`font-semibold ${
                            item.purchased ? 'text-slate-600 line-through' : 'text-slate-900'
                          }`}
                        >
                          {item.name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {item.category}
                          {(item.quantity || 1) > 1 && (
                            <span> · {item.quantity} unit ({formatIDR(item.price)}/unit)</span>
                          )}
                          {item.notes && <span> · {item.notes}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatIDR(totalLine)}
                      </td>

                      <td className="py-3.5 px-3 align-top text-xs">
                        {safeHref ? (
                          <a
                            href={safeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-teal-700 font-medium hover:underline max-w-[240px]"
                            title={safeHref}
                          >
                            <span className="truncate">{getHostname(safeHref)}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400">Belum ada link</span>
                        )}
                      </td>

                      <td className="py-3.5 pr-5 pl-3 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            aria-label={`Ubah ${item.name}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item)}
                            aria-label={`Hapus ${item.name}`}
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
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-900">
                  <td className="py-3 pl-5 pr-3" colSpan={2}>
                    Total List Barang ({filteredItems.length} item)
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-teal-700">
                    {formatIDR(
                      filteredItems.reduce((s, it) => s + it.price * (it.quantity || 1), 0)
                    )}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
