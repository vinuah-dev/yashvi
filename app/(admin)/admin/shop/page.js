"use client";

/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  ShoppingBag, Plus, X, Edit3, Trash2, Package, DollarSign,
  Tag, Archive, Eye, EyeOff, Settings, Gift, Users, Star,
  ChevronDown, ChevronUp, AlertTriangle, Search, Hash,
  Percent, TrendingUp, ShoppingCart, Image as ImageIcon, Boxes, Receipt, Clock,
} from "lucide-react";

// ─── Add/Edit Item Modal ─────────────────────────────────────
function ItemModal({ open, onClose, onSave, editItem }) {
  const [name, setName] = useState(editItem?.name || "");
  const [description, setDescription] = useState(editItem?.description || "");
  const [price, setPrice] = useState(editItem?.price || "");
  const [imageUrl, setImageUrl] = useState(editItem?.image_url || "");
  const [category, setCategory] = useState(editItem?.category || "general");
  const [stock, setStock] = useState(editItem?.stock === -1 ? "" : editItem?.stock || "");
  const [unlimited, setUnlimited] = useState(editItem?.stock === -1 || !editItem);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(editItem?.name || ""); setDescription(editItem?.description || "");
    setPrice(editItem?.price || ""); setImageUrl(editItem?.image_url || ""); setCategory(editItem?.category || "general");
    setStock(editItem?.stock === -1 ? "" : editItem?.stock || "");
    setUnlimited(editItem?.stock === -1 || !editItem);
  }, [editItem]);

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim() || !price) return;
    setSaving(true);
    await onSave({
      name: name.trim(), description: description.trim(),
      price: parseFloat(price), image_url: imageUrl.trim() || null, category: category.trim(),
      stock: unlimited ? -1 : parseInt(stock) || 0,
      ...(editItem ? { item_id: editItem.id } : {}),
    });
    setSaving(false); onClose();
  };

  const CATEGORIES = ["general", "supplements", "apparel", "equipment", "beverages", "snacks", "accessories"];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{editItem ? "Edit Item" : "Add Item"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Item Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Protein Shake"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20" /></div>

          <div className="grid grid-cols-[72px_1fr] gap-3 items-center rounded-2xl bg-orange-50/70 border border-orange-100 p-2">
            <div className="aspect-square overflow-hidden rounded-xl bg-white flex items-center justify-center">
              {imageUrl ? <img src={imageUrl} alt="Product preview" className="h-full w-full object-cover" /> : <ImageIcon className="w-7 h-7 text-[#f0813d]" />}
            </div>
            <div><label className="text-xs font-medium text-gray-500 mb-1 block">Product Image URL</label>
              <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..."
                className="w-full px-3 py-2.5 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20" /></div>
          </div>

          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional description"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20 resize-none" /></div>

          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Price (₹) *</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20" /></div>

          <div><label className="text-xs font-medium text-gray-500 mb-2 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize ${category === c ? "border-[#f0813d] bg-orange-50 text-[#f0813d]" : "border-gray-200 text-gray-500"}`}>
                  {c}</button>
              ))}
            </div></div>

          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Stock</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} className="rounded" />
                Unlimited
              </label>
              {!unlimited && <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="Qty"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" />}
            </div></div>

          <button onClick={handleSave} disabled={!name.trim() || !price || saving}
            className="w-full py-3 bg-[#f0813d] text-white rounded-xl font-semibold text-sm active:scale-95 disabled:opacity-50">
            {saving ? "Saving..." : editItem ? "Update Item" : "Add Item"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Referral Settings Modal ─────────────────────────────────
function ReferralSettingsModal({ open, onClose, settings, onSave }) {
  const [pointsPerReferral, setPointsPerReferral] = useState(settings?.points_per_referral || 50);
  const [ratio, setRatio] = useState(settings?.points_to_currency_ratio || 1);
  const [active, setActive] = useState(settings?.is_active !== false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-[#f0813d]" /> Reward Settings</h3>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Points per Referral</label>
            <input type="number" value={pointsPerReferral} onChange={e => setPointsPerReferral(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" /></div>
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Points to ₹ Ratio (1 point = ₹___)</label>
            <input type="number" step="0.1" value={ratio} onChange={e => setRatio(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            <p className="text-xs text-gray-400 mt-1">Example: 1.0 means 100 points = ₹100 discount</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" /> Referral system active</label>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">Cancel</button>
            <button onClick={async () => { setSaving(true); await onSave({ points_per_referral: pointsPerReferral, points_to_currency_ratio: ratio, is_active: active }); setSaving(false); onClose(); }}
              disabled={saving} className="flex-1 py-2.5 bg-[#f0813d] text-white rounded-xl text-sm font-medium">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function AdminShopPage() {
  const { user, selectedGym, isReady } = useAuthContext();
  const { showToast } = useToast();
  const [tab, setTab] = useState("items"); // items | orders
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const gymId = selectedGym?.id;

  const apiCall = useCallback(async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": user?.id || "" },
      body: JSON.stringify(body),
    });
    return res.json();
  }, [user?.id]);

  const fetchItems = useCallback(async () => {
    const json = await apiCall("/api/shop", { action: "list_items", active_only: false });
    setItems(json.data || []);
  }, [apiCall]);

  const fetchOrders = useCallback(async () => {
    const json = await apiCall("/api/shop", { action: "all_orders", limit: 50 });
    setOrders(json.data || []);
  }, [apiCall]);

  const fetchSettings = useCallback(async () => {
    const json = await apiCall("/api/referral", { action: "get_settings" });
    setSettings(json.data);
  }, [apiCall]);

  useEffect(() => {
    if (gymId && isReady) {
      Promise.all([fetchItems(), fetchSettings(), fetchOrders()]).then(() => setLoading(false));
    } else if (isReady) setLoading(false);
  }, [gymId, isReady, fetchItems, fetchSettings, fetchOrders]);

  useEffect(() => { if (tab === "orders" && orders.length === 0) fetchOrders(); }, [tab, orders.length, fetchOrders]);

  const handleSaveItem = async (data) => {
    const action = data.item_id ? "update_item" : "add_item";
    const json = await apiCall("/api/shop", { action, ...data });
    if (json.success || json.data) { showToast(data.item_id ? "Item updated" : "Item added", "success"); fetchItems(); }
    else showToast(json.error || "Failed", "error");
  };

  const handleDeleteItem = async (id) => {
    const json = await apiCall("/api/shop", { action: "delete_item", item_id: id });
    if (json.success) { showToast("Item deleted", "success"); fetchItems(); }
    else showToast(json.error || "Failed", "error");
    setConfirmDelete(null);
  };

  const handleToggleItem = async (item) => {
    await apiCall("/api/shop", { action: "update_item", item_id: item.id, is_active: !item.is_active });
    fetchItems();
  };

  const handleSaveSettings = async (data) => {
    const json = await apiCall("/api/referral", { action: "update_settings", ...data });
    if (json.success) { showToast("Settings saved", "success"); fetchSettings(); }
    else showToast(json.error || "Failed", "error");
  };

  const filtered = items.filter(i => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const shopStats = useMemo(() => {
    const activeItems = items.filter((item) => item.is_active !== false).length;
    const lowStock = items.filter((item) => item.stock !== -1 && Number(item.stock || 0) <= 5).length;
    const inventoryValue = items.reduce((sum, item) => {
      if (item.stock === -1) return sum;
      return sum + Number(item.price || 0) * Number(item.stock || 0);
    }, 0);
    const orderRevenue = orders.reduce((sum, order) => sum + Number(order.total || order.final_amount || 0), 0);
    const categories = new Set(items.map((item) => item.category || "general"));
    return { activeItems, lowStock, inventoryValue, orderRevenue, categories: categories.size };
  }, [items, orders]);

  if (loading) return (<div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100"><Header title="Shop" /><div className="flex items-center justify-center py-20"><div className="w-12 h-12 border-4 border-[#f0813d] border-t-transparent rounded-full animate-spin"></div></div></div>);

  return (
    <div className="min-h-screen bg-[#fff7ef] mb-17 safe-area-inset-bottom">
      <Header title="Shop Management" />
      <main className="px-3 md:px-8 py-3 space-y-4 max-w-7xl mx-auto">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#ffcf9b] via-[#fff0dc] to-[#ddf7df] p-5 border border-white shadow-[0_18px_55px_rgba(232,139,63,0.18)]">
          <div className="absolute right-4 top-4 h-24 w-24 rounded-full bg-white/45 blur-2xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#c46a25]">
                <ShoppingBag className="h-3.5 w-3.5" /> Retail control room
              </div>
              <h1 className="text-3xl font-black leading-tight text-[#3a2b21] md:text-4xl">Shop that feels alive</h1>
              <p className="mt-2 max-w-xl text-sm font-medium text-[#846b58]">
                Manage products, stock, rewards and member orders from one energetic counter.
              </p>
            </div>
            <button onClick={() => { setEditItem(null); setShowItemModal(true); }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f0813d] px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(240,129,61,0.3)] active:scale-95">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Active items", value: shopStats.activeItems, icon: <Package className="w-5 h-5" />, tone: "from-[#fff2df] to-[#ffe1bb]", text: "text-[#c46a25]" },
            { label: "Stock alerts", value: shopStats.lowStock, icon: <AlertTriangle className="w-5 h-5" />, tone: "from-[#ffe9e4] to-[#ffd7cc]", text: "text-[#d45b3c]" },
            { label: "Inventory value", value: `₹${shopStats.inventoryValue.toLocaleString("en-IN")}`, icon: <Boxes className="w-5 h-5" />, tone: "from-[#eaf8e6] to-[#d6f0ce]", text: "text-[#4f8f36]" },
            { label: "Recent orders", value: orders.length, icon: <Receipt className="w-5 h-5" />, tone: "from-[#eef5ff] to-[#dfeeff]", text: "text-[#4775b9]" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-[22px] bg-gradient-to-br ${stat.tone} p-4 border border-white shadow-sm`}>
              <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 ${stat.text}`}>{stat.icon}</div>
              <p className="text-[11px] font-black uppercase tracking-wide text-[#8b7a6c]">{stat.label}</p>
              <p className={`mt-1 text-2xl font-black ${stat.text}`}>{stat.value}</p>
            </div>
          ))}
        </section>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/85 rounded-2xl shadow-sm border border-[#f0dfcf]">
          {[{ key: "items", label: "Items", icon: <Package className="w-4 h-4" /> }, { key: "orders", label: "Orders", icon: <ShoppingCart className="w-4 h-4" /> }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-black transition-all ${tab === t.key ?"bg-[#f0813d] text-white shadow-md" :"text-[#8b7a6c] hover:bg-[#fff4e9]"}`}>
              {t.icon} {t.label}
            </button>
          ))}
          <button onClick={() => setShowSettings(true)} className="px-3 py-2.5 rounded-xl text-[#8b7a6c] hover:bg-[#fff4e9]"><Settings className="w-4 h-4" /></button>
        </div>

        {/* ITEMS TAB */}
        {tab === "items" && (<>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c46a25]" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search items..."
                className="w-full pl-9 pr-4 py-3 bg-white border border-[#f0dfcf] rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#f0813d]/20" />
            </div>
            <button onClick={() => { setEditItem(null); setShowItemModal(true); }}
              className="px-4 py-3 bg-[#f0813d] text-white rounded-2xl text-sm font-black flex items-center gap-1 active:scale-95 shadow-sm">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16"><ShoppingBag className="w-12 h-12 text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No items yet</p></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map(item => (
                <div key={item.id} className={`bg-white rounded-[24px] shadow-sm border border-[#f0dfcf] p-3 ${!item.is_active ? "opacity-70" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-20 h-20 overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff2df] to-[#eaf8e6] flex items-center justify-center flex-shrink-0">
                      {item.image_url ? <img src={item.image_url} alt={`${item.name} product`} className="h-full w-full object-cover" /> : <Package className="w-8 h-8 text-[#f0813d]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-[#3a2b21] text-sm truncate">{item.name}</h3>
                        <span className="text-xs bg-[#fff2df] text-[#c46a25] px-2 py-0.5 rounded-full capitalize font-bold">{item.category}</span>
                        {!item.is_active && <span className="text-xs bg-[#ffe9e4] text-[#d45b3c] px-2 py-0.5 rounded-full font-bold">Hidden</span>}
                      </div>
                      {item.description && <p className="text-xs text-[#8b7a6c] mt-0.5 line-clamp-2">{item.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-base font-black text-gray-800">₹{item.price}</span>
                        <span className={`text-xs font-bold ${item.stock !== -1 && Number(item.stock || 0) <= 5 ? "text-[#d45b3c]" : "text-[#4f8f36]"}`}>{item.stock === -1 ? "Unlimited stock" : `${item.stock} in stock`}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleToggleItem(item)} className="w-8 h-8 rounded-xl bg-[#fff2df] flex items-center justify-center text-[#c46a25]">
                        {item.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { setEditItem(item); setShowItemModal(true); }} className="w-8 h-8 rounded-xl bg-[#eaf8e6] flex items-center justify-center text-[#4f8f36]"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => setConfirmDelete(item)} className="w-8 h-8 rounded-xl bg-[#ffe9e4] flex items-center justify-center text-[#d45b3c]"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* ORDERS TAB */}
        {tab === "orders" && (<>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center py-16"><ShoppingCart className="w-12 h-12 text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No orders yet</p></div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {orders.map(order => (
                <div key={order.id} className="bg-white rounded-[24px] shadow-sm border border-[#f0dfcf] p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="font-black text-sm text-[#3a2b21]">{order.members?.full_name || "Member"}</p>
                      <p className="text-xs font-medium text-[#8b7a6c]">{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-gray-800">₹{order.total}</p>
                      {order.points_used > 0 && <p className="text-xs text-[#f0813d]">-{order.points_used} pts (₹{order.points_discount})</p>}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#fff8f0] p-3 text-xs font-semibold text-[#8b7a6c]">
                    {(order.items || []).map((item, i) => <span key={i}>{item.name} ×{item.qty}{i < order.items.length - 1 ? ", " : ""}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}

        <div className="h-4"></div>
      </main>

      <ItemModal open={showItemModal} onClose={() => { setShowItemModal(false); setEditItem(null); }} onSave={handleSaveItem} editItem={editItem} />
      <ReferralSettingsModal open={showSettings} onClose={() => setShowSettings(false)} settings={settings} onSave={handleSaveSettings} />

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">Delete Item</h3>
            <p className="text-sm text-gray-600 mb-4">Delete &quot;{confirmDelete.name}&quot;? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">Cancel</button>
              <button onClick={() => handleDeleteItem(confirmDelete.id)} className="flex-1 py-2.5 bg-[#f0813d] text-white rounded-xl text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
