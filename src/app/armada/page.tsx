'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Bus as BusIcon, QrCode, BarChart2, User, Search, CalendarDays, MapPin } from 'lucide-react';
import { getAgentSession, clearAgentSession } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Bus } from '@/types';

type ArahFilter = 'ALL' | 'TIMUR' | 'BARAT';

export default function ArmadaPage() {
    const router = useRouter();
    const [agent, setAgent] = useState<{ name: string; location: string } | null>(null);
    const [buses, setBuses] = useState<Bus[]>([]);
    const [filtered, setFiltered] = useState<Bus[]>([]);
    const [arah, setArah] = useState<ArahFilter>('ALL');
    const [search, setSearch] = useState('');
    const [date, setDate] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setDate(format(new Date(), 'yyyy-MM-dd'));
    }, []);

    useEffect(() => {
        const session = getAgentSession();
        if (!session) { router.replace('/'); return; }
        setAgent(session);
    }, [router]);

    const fetchBuses = useCallback(async () => {
        if (!date) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('buses')
                .select('*')
                .eq('aktif', true)
                .eq('tanggal', date)
                .order('jam_berangkat');
            if (error) throw error;
            setBuses((data as Bus[]) || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => { fetchBuses(); }, [fetchBuses]);

    useEffect(() => {
        let result = buses;
        if (arah !== 'ALL') result = result.filter(b => b.arah === arah);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(b =>
                b.nama.toLowerCase().includes(q) || b.kode.toLowerCase().includes(q)
            );
        }
        setFiltered(result);
    }, [buses, arah, search]);

    const displayDate = date ? format(new Date(date + 'T00:00:00'), "EEEE, d MMMM yyyy", { locale: idLocale }) : '';

    return (
        <div style={{ background: 'var(--gray-bg)', minHeight: '100vh' }}>
            {/* Header */}
            <div className="header-maroon">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>ARMADA</h1>
                    <button
                        onClick={() => { clearAgentSession(); router.push('/'); }}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, cursor: 'pointer' }}
                    >
                        Keluar
                    </button>
                </div>
                {agent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={18} color="white" />
                        </div>
                        <div>
                            <p style={{ fontSize: 15, fontWeight: 700 }}>{agent.name}</p>
                            <p style={{ fontSize: 12, opacity: 0.8 }}>{agent.location}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Date & Search Bar */}
            <div style={{ background: 'white', padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <CalendarDays size={16} color="#8B1A1A" />
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        style={{ border: 'none', outline: 'none', fontSize: 14, color: '#333', background: 'transparent', cursor: 'pointer' }}
                    />
                </div>
                <div style={{ color: '#ccc' }}>|</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Search size={16} color="#aaa" />
                    <input
                        type="search"
                        placeholder="Cari Armada..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ border: 'none', outline: 'none', fontSize: 14, color: '#333', background: 'transparent', width: '100%' }}
                    />
                </div>
            </div>

            {/* Total & Filter */}
            <div style={{ background: '#f9f0f0', padding: '8px 16px', fontSize: 13, color: '#666' }}>
                Total Armada {filtered.length}
            </div>
            <div style={{ background: 'white', padding: '10px 16px', display: 'flex', gap: 8 }}>
                {(['ALL', 'TIMUR', 'BARAT'] as ArahFilter[]).map(f => (
                    <button key={f} className={`filter-chip ${arah === f ? 'active' : ''}`} onClick={() => setArah(f)}>{f}</button>
                ))}
            </div>

            {/* Bus List */}
            <div className="page-content">
                {loading ? (
                    <div style={{ padding: '40px 16px', textAlign: 'center', color: '#aaa' }}>
                        <div className="animate-pulse">Memuat armada...</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '60px 16px', textAlign: 'center', color: '#aaa' }}>
                        <BusIcon size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                        <p>Tidak ada armada ditemukan</p>
                    </div>
                ) : (
                    filtered.map((bus) => (
                        <div
                            key={bus.id}
                            className="card-route animate-in"
                            onClick={() => router.push(`/armada/${bus.id}?date=${date}`)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                        <MapPin size={12} color="#8B1A1A" />
                                        <span style={{ fontSize: 11, color: '#8B1A1A', fontWeight: 600 }}>Jadwal bus</span>
                                    </div>
                                    <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.3 }}>{bus.nama}</p>
                                    <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                                        {bus.arah} / {bus.kode}
                                    </p>
                                </div>
                                <p style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1A', whiteSpace: 'nowrap', marginLeft: 12 }}>
                                    {bus.jam_berangkat}:00
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <div className="bottom-nav-item active">
                    <BusIcon size={22} />
                    <span>Armada</span>
                </div>
                <div className="bottom-nav-item" onClick={() => { }}>
                    <QrCode size={22} />
                    <span>QR</span>
                </div>
                <div className="bottom-nav-item" onClick={() => router.push('/laporan')}>
                    <BarChart2 size={22} />
                    <span>Laporan</span>
                </div>
                <div className="bottom-nav-item" onClick={() => router.push('/admin')}>
                    <User size={22} />
                    <span>Admin</span>
                </div>
            </nav>
        </div>
    );
}
