'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import type { Bus, Booking } from '@/types';

export default function AdminManifestPage() {
    const router = useRouter();
    const [buses, setBuses] = useState<Bus[]>([]);
    const [selectedBus, setSelectedBus] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [bookings, setBookings] = useState<(Booking & { buses: Bus })[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('admin_auth') !== 'true') {
            router.replace('/admin');
        }
        supabase.from('buses').select('*').eq('aktif', true).then(({ data }) => setBuses((data as Bus[]) || []));
    }, [router]);

    const fetchManifest = useCallback(async () => {
        if (!selectedBus) return;
        setLoading(true);
        const { data } = await supabase
            .from('bookings')
            .select('*, buses(kode, nama, arah, jam_berangkat)')
            .eq('bus_id', selectedBus)
            .eq('status', 'confirmed')
            .gte('created_at', `${selectedDate}T00:00:00`)
            .lte('created_at', `${selectedDate}T23:59:59`)
            .order('nomor_kursi');
        setBookings((data as (Booking & { buses: Bus })[]) || []);
        setLoading(false);
    }, [selectedBus, selectedDate]);

    useEffect(() => { fetchManifest(); }, [fetchManifest]);

    const bus = buses.find(b => b.id === selectedBus);
    const displayDate = format(new Date(selectedDate + 'T00:00:00'), "d MMMM yyyy", { locale: idLocale });

    return (
        <div style={{ background: 'var(--gray-bg)', minHeight: '100vh' }}>
            <div className="header-maroon" style={{ printVisibility: 'hidden' } as React.CSSProperties}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => router.push('/admin/dashboard')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><ArrowLeft size={20} /></button>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, opacity: 0.7 }}>Admin</p>
                        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Manifest Penumpang</h1>
                    </div>
                    {bookings.length > 0 && (
                        <button onClick={() => window.print()} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '8px 12px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            <Printer size={15} /> Print
                        </button>
                    )}
                </div>
            </div>

            {/* Filter */}
            <div style={{ background: 'white', padding: '12px 16px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
                <select className="input-field" value={selectedBus} onChange={e => setSelectedBus(e.target.value)} style={{ flex: 2, padding: '10px 12px', fontSize: 13 }}>
                    <option value="">-- Pilih Bus --</option>
                    {buses.map(b => <option key={b.id} value={b.id}>{b.kode} - {b.arah}</option>)}
                </select>
                <input type="date" className="input-field" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ flex: 1, padding: '10px 12px', fontSize: 13 }} />
            </div>

            {!selectedBus ? (
                <div style={{ padding: '60px 16px', textAlign: 'center', color: '#aaa' }}>
                    <p>Pilih bus untuk melihat manifest</p>
                </div>
            ) : loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }} className="animate-pulse">Memuat manifest...</div>
            ) : (
                <>
                    {/* Manifest Header (print-friendly) */}
                    <div style={{ background: 'white', margin: '10px 16px', borderRadius: 12, padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <h2 style={{ fontSize: 16, fontWeight: 800, textAlign: 'center', borderBottom: '2px solid #8B1A1A', paddingBottom: 8, marginBottom: 10 }}>MANIFEST PENUMPANG</h2>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <div>
                                <p><strong>Bus:</strong> {bus?.kode}</p>
                                <p><strong>Rute:</strong> {bus?.nama}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p><strong>Tanggal:</strong> {displayDate}</p>
                                <p><strong>Jam:</strong> {bus?.jam_berangkat}</p>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div style={{ display: 'flex', gap: 10, padding: '0 16px 10px' }}>
                        <div style={{ flex: 1, background: 'white', borderRadius: 10, padding: '12px', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                            <p style={{ fontSize: 22, fontWeight: 800, color: '#8B1A1A' }}>{bookings.length}</p>
                            <p style={{ fontSize: 11, color: '#888' }}>Penumpang</p>
                        </div>
                        <div style={{ flex: 1, background: 'white', borderRadius: 10, padding: '12px', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                            <p style={{ fontSize: 22, fontWeight: 800, color: '#1565C0' }}>{bus?.kapasitas || 0 - bookings.length}</p>
                            <p style={{ fontSize: 11, color: '#888' }}>Kursi Kosong</p>
                        </div>
                        <div style={{ flex: 1, background: 'white', borderRadius: 10, padding: '12px', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                            <p style={{ fontSize: 18, fontWeight: 800, color: '#2E7D32' }}>
                                {bus?.kapasitas ? Math.round((bookings.length / bus.kapasitas) * 100) : 0}%
                            </p>
                            <p style={{ fontSize: 11, color: '#888' }}>Terisi</p>
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ margin: '0 16px', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 90px 70px', background: '#8B1A1A', color: 'white', padding: '10px 12px', fontSize: 11, fontWeight: 700, gap: 4 }}>
                            <span>No</span><span>Nama</span><span>Tujuan</span><span>Agen</span><span>HP</span>
                        </div>
                        {bookings.map((b, i) => (
                            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 90px 70px', padding: '10px 12px', fontSize: 12, borderBottom: i < bookings.length - 1 ? '1px solid #f0f0f0' : 'none', gap: 4, background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                <span style={{ fontWeight: 700, color: '#8B1A1A' }}>{b.nomor_kursi}</span>
                                <span style={{ fontWeight: 600 }}>{b.passenger_name}</span>
                                <span style={{ color: '#555' }}>{b.tujuan}</span>
                                <span style={{ color: '#555' }}>{b.agent_name}</span>
                                <span style={{ color: '#888', fontSize: 10 }}>{b.passenger_phone.slice(-6)}</span>
                            </div>
                        ))}
                        {bookings.length === 0 && (
                            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>Belum ada penumpang</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
