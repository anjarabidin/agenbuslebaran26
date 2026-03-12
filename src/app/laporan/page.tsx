'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Bus as BusIcon, BarChart2, User, ChevronLeft, QrCode } from 'lucide-react';
import { getAgentSession, formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Booking, Bus } from '@/types';

export default function LaporanPage() {
    const router = useRouter();
    const [agent, setAgent] = useState<{ name: string; location: string; phone: string } | null>(null);
    const [bookings, setBookings] = useState<(Booking & { buses: Bus })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const session = getAgentSession();
        if (!session) {
            router.replace('/');
            return;
        }
        setAgent(session);
    }, [router]);

    const fetchHistory = useCallback(async (phone: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, buses(*)')
                .eq('agent_phone', phone)
                .eq('status', 'confirmed')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBookings((data as (Booking & { buses: Bus })[]) || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (agent?.phone) {
            fetchHistory(agent.phone);
        }
    }, [agent, fetchHistory]);

    return (
        <div style={{ background: 'var(--gray-bg)', minHeight: '100vh', paddingBottom: 80 }}>
            {/* Header */}
            <div className="header-maroon">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <button 
                        onClick={() => router.push('/armada')}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 8, color: 'white', cursor: 'pointer', display: 'flex' }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>LAPORAN SAYA</h1>
                </div>
                {agent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={18} color="white" />
                        </div>
                        <div>
                            <p style={{ fontSize: 15, fontWeight: 700 }}>{agent.name}</p>
                            <p style={{ fontSize: 12, opacity: 0.8 }}>ID: {agent.phone}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Summary Card */}
            <div style={{ padding: '0 16px', marginTop: -20 }}>
                <div style={{ background: 'white', borderRadius: 16, padding: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Total Penjualan</p>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#8B1A1A', marginTop: 4 }}>
                            {formatCurrency(bookings.reduce((sum, b) => sum + b.harga, 0))}
                        </h2>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Total Tiket</p>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#333', marginTop: 4 }}>{bookings.length}</h2>
                    </div>
                </div>
            </div>

            {/* List */}
            <div style={{ padding: '24px 16px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#666', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Riwayat Pemesanan</p>
                
                {loading ? (
                    <div style={{ padding: '40px 16px', textAlign: 'center', color: '#aaa' }}>Memuat riwayat...</div>
                ) : bookings.length === 0 ? (
                    <div style={{ padding: '60px 16px', textAlign: 'center', color: '#aaa' }}>
                        <BarChart2 size={48} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                        <p>Belum ada riwayat pesanan</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {bookings.map((b) => (
                            <div key={b.id} style={{ background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#8B1A1A', textTransform: 'uppercase' }}>
                                            {format(new Date(b.created_at), "d MMM yyyy • HH:mm", { locale: idLocale })}
                                        </p>
                                        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginTop: 2 }}>{b.passenger_name}</p>
                                    </div>
                                    <span style={{ background: '#E8F5E9', color: '#2E7D32', fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 6 }}>BERHASIL</span>
                                </div>
                                
                                <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px dashed #eee', borderBottom: '1px dashed #eee', marginBottom: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 11, color: '#888' }}>Armada</p>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{b.buses?.kode} ({b.buses?.arah})</p>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 11, color: '#888' }}>Kursi</p>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>No. {b.nomor_kursi}</p>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 11, color: '#888' }}>Tujuan</p>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{b.tujuan}</p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <p style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A' }}>{formatCurrency(b.harga)}</p>
                                    <button 
                                        onClick={() => router.push(`/armada/${b.bus_id}`)}
                                        style={{ background: '#f5f5f5', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#666', cursor: 'pointer' }}
                                    >
                                        Lihat Bus
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <div className="bottom-nav-item" onClick={() => router.push('/armada')}>
                    <BusIcon size={22} />
                    <span>Armada</span>
                </div>
                <div className="bottom-nav-item" onClick={() => { }}>
                    <QrCode size={22} />
                    <span>QR</span>
                </div>
                <div className="bottom-nav-item active">
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
