'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Pencil, Archive, X, Check, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Bus } from '@/types';

const EMPTY_FORM: Omit<Bus, 'id' | 'created_at'> = {
    kode: '', nama: '', kapasitas: 24, arah: 'TIMUR', jam_berangkat: '18:45', tanggal: new Date().toISOString().split('T')[0], aktif: true,
};

export default function AdminBusesPage() {
    const router = useRouter();
    const [buses, setBuses] = useState<Bus[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [editId, setEditId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('admin_auth') !== 'true') {
            router.replace('/admin');
        }
    }, [router]);

    const fetch = useCallback(async () => {
        let q = supabase.from('buses').select('*').order('tanggal', { ascending: false }).order('jam_berangkat');
        if (filterDate) q = q.eq('tanggal', filterDate);
        const { data } = await q;
        let res = (data as Bus[]) || [];
        
        if (searchTerm) {
            const low = searchTerm.toLowerCase();
            res = res.filter(b => b.kode.toLowerCase().includes(low) || b.nama.toLowerCase().includes(low));
        }
        setBuses(res);
    }, [filterDate, searchTerm]);

    useEffect(() => { fetch(); }, [fetch]);

    function openEdit(bus: Bus) {
        setForm({ kode: bus.kode, nama: bus.nama, kapasitas: bus.kapasitas, arah: bus.arah, jam_berangkat: bus.jam_berangkat, tanggal: bus.tanggal, aktif: bus.aktif });
        setEditId(bus.id);
        setShowForm(true);
    }

    async function handleSave() {
        setLoading(true);
        if (editId) {
            await supabase.from('buses').update(form).eq('id', editId);
        } else {
            await supabase.from('buses').insert(form);
        }
        setMsg(editId ? 'Bus diperbarui' : 'Bus ditambahkan');
        setShowForm(false);
        setEditId(null);
        setForm({ ...EMPTY_FORM });
        await fetch();
        setLoading(false);
        setTimeout(() => setMsg(''), 2000);
    }

    async function handleArchive(id: string, kode: string) {
        if (!confirm(`Arsipkan bus ${kode}? Bus tidak akan muncul bagi agen namun semua data riwayat tetap tersimpan aman.`)) return;
        setLoading(true);
        const { error } = await supabase.from('buses').update({ aktif: false }).eq('id', id);
        if (error) {
            alert(`Gagal mengarsipkan: ${error.message}`);
        } else {
            setMsg(`Bus ${kode} berhasil diarsipkan`);
            setTimeout(() => setMsg(''), 3000);
        }
        await fetch();
        setLoading(false);
    }

    function formatNumber(val: number | string) {
        if (!val || val === 0 || val === '0') return '';
        return val.toString().replace(/^0+/, '');
    }

    return (
        <div style={{ background: 'var(--gray-bg)', minHeight: '100vh' }}>
            <div className="header-maroon">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => router.push('/admin/dashboard')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, opacity: 0.7 }}>Admin</p>
                        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Manajemen Bus</h1>
                    </div>
                    <button
                        onClick={() => { setShowForm(true); setEditId(null); setForm({ ...EMPTY_FORM }); }}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
                    >
                        <Plus size={16} /> Tambah
                    </button>
                </div>
            </div>

            {msg && <div style={{ margin: '10px 16px', background: '#E8F5E9', borderRadius: 8, padding: '10px 14px', color: '#2E7D32', fontSize: 13, fontWeight: 600 }}>✓ {msg}</div>}

            {/* Filter Section */}
            <div style={{ background: 'white', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <input 
                            type="date" 
                            className="input-field" 
                            value={filterDate} 
                            onChange={e => setFilterDate(e.target.value)} 
                            style={{ padding: '9px 12px', fontSize: 13 }} 
                        />
                    </div>
                    <div style={{ flex: 1.5 }}>
                        <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Cari Kode / Nama..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            style={{ padding: '9px 12px', fontSize: 13 }} 
                        />
                    </div>
                </div>
                {(filterDate || searchTerm) && (
                    <button 
                        onClick={() => { setFilterDate(''); setSearchTerm(''); }}
                        style={{ background: 'none', border: 'none', color: '#8B1A1A', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'right' }}
                    >
                        ✕ Bersihkan Filter
                    </button>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <div style={{ background: 'white', margin: '10px 16px', borderRadius: 14, padding: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{editId ? 'Edit Bus' : 'Tambah Bus Baru'}</h3>
                        <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <input className="input-field" placeholder="Kode Bus (mis: SHL-02)" value={form.kode} onChange={e => setForm(f => ({ ...f, kode: e.target.value }))} />
                        <input className="input-field" placeholder="Nama Rute (mis: Jepara - Ciledug)" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <input
                                className="input-field"
                                type="text"
                                placeholder="Kapasitas"
                                value={formatNumber(form.kapasitas)}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setForm(f => ({ ...f, kapasitas: parseInt(val) || 0 }));
                                }}
                                style={{ flex: 1 }}
                            />
                            <input className="input-field" type="time" value={form.jam_berangkat} onChange={e => setForm(f => ({ ...f, jam_berangkat: e.target.value }))} style={{ flex: 1 }} />
                        </div>
                        <input className="input-field" type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} />
                        <select className="input-field" value={form.arah} onChange={e => setForm(f => ({ ...f, arah: e.target.value as 'TIMUR' | 'BARAT' }))}>
                            <option value="TIMUR">TIMUR</option>
                            <option value="BARAT">BARAT</option>
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                            <input type="checkbox" checked={form.aktif} onChange={e => setForm(f => ({ ...f, aktif: e.target.checked }))} />
                            Bus Aktif
                        </label>
                    </div>
                    <button className="btn-primary" onClick={handleSave} disabled={loading || !form.kode || !form.nama} style={{ marginTop: 16 }}>
                        {loading ? 'Menyimpan...' : <><Check size={16} style={{ display: 'inline', marginRight: 6 }} />Simpan</>}
                    </button>
                </div>
            )}

            {/* Bus List */}
            <div style={{ padding: '8px 16px 80px' }}>
                {buses.map(bus => (
                    <div key={bus.id} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                    <span className="badge badge-maroon">{bus.arah}</span>
                                    <span className="badge" style={{ background: bus.aktif ? '#e8f5e9' : '#f5f5f5', color: bus.aktif ? '#2E7D32' : '#999' }}>{bus.aktif ? 'Aktif' : 'Nonaktif'}</span>
                                </div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#8B1A1A' }}>{bus.kode}</p>
                                <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{bus.nama}</p>
                                <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                                    📅 {new Date(bus.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • 💺 {bus.kapasitas} kursi • ⏰ {bus.jam_berangkat}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignSelf: 'center' }}>
                                <button 
                                    onClick={() => openEdit(bus)} 
                                    style={{ background: '#f0f4ff', border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Edit"
                                >
                                    <Pencil size={18} color="#1565C0" />
                                </button>
                                <button 
                                    onClick={() => handleArchive(bus.id, bus.kode)} 
                                    style={{ background: '#fff0f0', border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Arsipkan"
                                >
                                    <Archive size={18} color="#C62828" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {buses.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 16px', color: '#aaa' }}>Belum ada bus. Klik Tambah untuk menambahkan.</div>
                )}
            </div>
        </div>
    );
}
