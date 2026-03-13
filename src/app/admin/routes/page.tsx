'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { initSeats } from '@/lib/db';
import type { Bus, Route, RoutePrice } from '@/types';

export default function AdminRoutesPage() {
    const router = useRouter();
    const [buses, setBuses] = useState<Bus[]>([]);
    const [routes, setRoutes] = useState<(Route & { buses: Bus; route_prices: RoutePrice[] })[]>([]);
    const [selectedBus, setSelectedBus] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const [form, setForm] = useState({ bus_id: '', kota_asal: 'Demak', kota_tujuan: '', via_stops: '', tanggal_berangkat: new Date().toISOString().split('T')[0] });
    const [prices, setPrices] = useState<{ tujuan: string; harga: number }[]>([{ tujuan: '', harga: 0 }]);

    useEffect(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('admin_auth') !== 'true') {
            router.replace('/admin');
        }
        supabase.from('buses').select('*').eq('aktif', true).then(({ data }) => setBuses((data as Bus[]) || []));
    }, [router]);

    const fetchRoutes = useCallback(async () => {
        let q = supabase.from('routes').select('*, buses(*), route_prices(*)').order('created_at', { ascending: false });
        if (selectedBus) q = q.eq('bus_id', selectedBus);  // Hanya filter jika dipilih
        if (selectedDate) q = q.eq('tanggal_berangkat', selectedDate);
        const { data } = await q;
        setRoutes((data as (Route & { buses: Bus; route_prices: RoutePrice[] })[]) || []);
    }, [selectedBus, selectedDate]);

    useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

    function openEdit(route: Route & { buses: Bus; route_prices: RoutePrice[] }) {
        setEditId(route.id);
        setForm({
            bus_id: route.bus_id,
            kota_asal: route.kota_asal,
            kota_tujuan: route.kota_tujuan,
            via_stops: route.via_stops?.join(', ') || '',
            tanggal_berangkat: route.tanggal_berangkat,
        });
        setPrices(route.route_prices?.map(p => ({ tujuan: p.tujuan, harga: p.harga })) || [{ tujuan: '', harga: 0 }]);
        setShowForm(true);
    }

    function openAdd() {
        setEditId(null);
        setForm({ bus_id: '', kota_asal: 'Demak', kota_tujuan: '', via_stops: '', tanggal_berangkat: new Date().toISOString().split('T')[0] });
        setPrices([{ tujuan: '', harga: 0 }]);
        setShowForm(true);
    }

    async function handleSave() {
        if (!form.bus_id || !form.kota_tujuan || prices.some(p => !p.tujuan)) return;
        setLoading(true);
        const via = form.via_stops.split(',').map(s => s.trim()).filter(Boolean);

        let routeId = editId;
        if (editId) {
            // MODE EDIT: update rute saja, TIDAK re-init kursi
            await supabase.from('routes').update({
                bus_id: form.bus_id,
                kota_asal: form.kota_asal,
                kota_tujuan: form.kota_tujuan,
                via_stops: via,
                tanggal_berangkat: form.tanggal_berangkat,
            }).eq('id', editId);
        } else {
            // MODE TAMBAH: buat rute baru + init kursi
            const { data } = await supabase.from('routes').insert({
                bus_id: form.bus_id,
                kota_asal: form.kota_asal,
                kota_tujuan: form.kota_tujuan,
                via_stops: via,
                tanggal_berangkat: form.tanggal_berangkat,
            }).select().single();
            routeId = data?.id;
        }

        if (routeId) {
            // Upsert prices
            await supabase.from('route_prices').delete().eq('route_id', routeId);
            await supabase.from('route_prices').insert(prices.map(p => ({ route_id: routeId!, ...p })));

            // Hanya init kursi jika ini RUTE BARU
            if (!editId) {
                const bus = buses.find(b => b.id === form.bus_id);
                if (bus) await initSeats(form.bus_id, routeId, bus.kapasitas);
            }
        }

        setMsg(editId ? 'Rute berhasil diperbarui' : 'Rute ditambahkan + kursi diinisialisasi');
        setShowForm(false);
        setEditId(null);
        setForm({ bus_id: '', kota_asal: 'Demak', kota_tujuan: '', via_stops: '', tanggal_berangkat: new Date().toISOString().split('T')[0] });
        setPrices([{ tujuan: '', harga: 0 }]);
        await fetchRoutes();
        setLoading(false);
        setTimeout(() => setMsg(''), 3000);
    }

    async function handleDelete(id: string) {
        if (!confirm('Hapus rute ini? Semua kursi dan harga akan terhapus.')) return;
        await supabase.from('routes').delete().eq('id', id);
        await fetchRoutes();
    }

    function addPrice() { setPrices(p => [...p, { tujuan: '', harga: 0 }]); }
    function removePrice(i: number) { setPrices(p => p.filter((_, idx) => idx !== i)); }

    function formatRibuan(val: number | string) {
        if (!val || val === '0') return '';
        return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    function parseRibuan(val: string) {
        return parseInt(val.replace(/\D/g, '')) || 0;
    }

    return (
        <div style={{ background: 'var(--gray-bg)', minHeight: '100vh' }}>
            <div className="header-maroon">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => router.push('/admin/dashboard')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><ArrowLeft size={20} /></button>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, opacity: 0.7 }}>Admin</p>
                        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Manajemen Rute</h1>
                    </div>
                    <button onClick={openAdd} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                        <Plus size={16} /> Tambah
                    </button>
                </div>
            </div>

            {msg && <div style={{ margin: '10px 16px', background: '#E8F5E9', borderRadius: 8, padding: '10px 14px', color: '#2E7D32', fontSize: 13 }}>✓ {msg}</div>}

            {/* Filter */}
            <div style={{ background: 'white', padding: '12px 16px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
                <select className="input-field" value={selectedBus} onChange={e => setSelectedBus(e.target.value)} style={{ flex: 1, padding: '9px 12px', fontSize: 13 }}>
                    <option value="">Semua Bus</option>
                    {buses.map(b => (
                        <option key={b.id} value={b.id}>
                            {b.kode} ({format(new Date(b.tanggal + 'T00:00:00'), "d MMM", { locale: idLocale })})
                        </option>
                    ))}
                </select>
                <input type="date" className="input-field" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} />
            </div>

            {/* Form Tambah / Edit */}
            {showForm && (
                <div style={{ background: 'white', margin: '10px 16px', borderRadius: 14, padding: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700 }}>{editId ? '✏️ Edit Rute' : '➕ Tambah Rute Baru'}</h3>
                        <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                    {editId && (
                        <div style={{ background: '#FFF3E0', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#E65100' }}>
                            ⚠️ Mode Edit: Kursi yang sudah ada tidak akan direset
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <select className="input-field" value={form.bus_id} onChange={e => setForm(f => ({ ...f, bus_id: e.target.value }))}>
                            <option value="">Pilih Bus</option>
                            {buses.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.kode} ({format(new Date(b.tanggal + 'T00:00:00'), "d MMM", { locale: idLocale })}) - {b.nama}
                                </option>
                            ))}
                        </select>
                        <input type="date" className="input-field" value={form.tanggal_berangkat} onChange={e => setForm(f => ({ ...f, tanggal_berangkat: e.target.value }))} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="input-field" placeholder="Kota Asal" value={form.kota_asal} onChange={e => setForm(f => ({ ...f, kota_asal: e.target.value }))} style={{ flex: 1 }} />
                            <input className="input-field" placeholder="Kota Tujuan" value={form.kota_tujuan} onChange={e => setForm(f => ({ ...f, kota_tujuan: e.target.value }))} style={{ flex: 1 }} />
                        </div>
                        <input className="input-field" placeholder="Via (pisah koma): Cikopo, Klari, Badami" value={form.via_stops} onChange={e => setForm(f => ({ ...f, via_stops: e.target.value }))} />

                        <p style={{ fontSize: 13, fontWeight: 600, color: '#555', marginTop: 4 }}>Harga per Tujuan</p>
                        {prices.map((p, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input className="input-field" placeholder="Kota Tujuan" value={p.tujuan} onChange={e => setPrices(prev => prev.map((pp, ii) => ii === i ? { ...pp, tujuan: e.target.value } : pp))} style={{ flex: 2 }} />
                                <input
                                    className="input-field"
                                    type="text"
                                    placeholder="Harga (mis: 260.000)"
                                    value={formatRibuan(p.harga)}
                                    onChange={e => {
                                        const num = parseRibuan(e.target.value);
                                        setPrices(prev => prev.map((pp, ii) => ii === i ? { ...pp, harga: num } : pp));
                                    }}
                                    style={{ flex: 1 }}
                                />
                                {prices.length > 1 && <button onClick={() => removePrice(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C62828' }}><X size={16} /></button>}
                            </div>
                        ))}
                        <button onClick={addPrice} style={{ background: 'none', border: '1.5px dashed #ccc', borderRadius: 8, padding: '8px', fontSize: 13, cursor: 'pointer', color: '#888' }}>+ Tambah Tujuan</button>
                    </div>
                    <button className="btn-primary" onClick={handleSave} disabled={loading || !form.bus_id || !form.kota_tujuan} style={{ marginTop: 14 }}>
                        {loading ? 'Menyimpan...' : editId ? <><Check size={16} style={{ display: 'inline', marginRight: 6 }} />Simpan Perubahan</> : '✓ Simpan Rute & Inisialisasi Kursi'}
                    </button>
                </div>
            )}

            {/* Route List */}
            <div style={{ padding: '8px 16px 80px' }}>
                {routes.map(route => (
                    <div key={route.id} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div>
                                <p style={{ fontSize: 12, color: '#888' }}>{route.buses?.kode} • {new Date(route.tanggal_berangkat + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                <p style={{ fontSize: 15, fontWeight: 700 }}>{route.kota_asal} → {route.kota_tujuan}</p>
                                {route.via_stops?.length > 0 && <p style={{ fontSize: 11, color: '#888' }}>Via: {route.via_stops.join(', ')}</p>}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={(e) => { e.stopPropagation(); openEdit(route); }} style={{ background: '#f0f4ff', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                                    <Pencil size={15} color="#1565C0" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(route.id); }} style={{ background: '#fff0f0', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                                    <Trash2 size={15} color="#C62828" />
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {route.route_prices?.map(rp => (
                                <span key={rp.id} style={{ background: '#f5f5f5', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#555' }}>
                                    {rp.tujuan}: Rp{(rp.harga / 1000).toFixed(0)}rb
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
                {routes.length === 0 && <div style={{ textAlign: 'center', padding: '60px 16px', color: '#aaa' }}>Belum ada rute. Klik Tambah.</div>}
            </div>
        </div>
    );
}
