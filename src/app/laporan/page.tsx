'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Bus as BusIcon, BarChart3, User, ChevronLeft, QrCode, Calendar, Search, Filter, ArrowRight, Wallet } from 'lucide-react';
import { getAgentSession, formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Booking, Bus } from '@/types';

export default function LaporanPage() {
    const router = useRouter();
    const [agent, setAgent] = useState<{ name: string; location: string; phone: string } | null>(null);
    const [bookings, setBookings] = useState<(Booking & { buses: Bus })[]>([]);
    const [filteredBookings, setFilteredBookings] = useState<(Booking & { buses: Bus })[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [searchTerm, setSearchTerm] = useState('');

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

    // Client-side filtering
    useEffect(() => {
        let result = bookings;

        // Date Filter
        if (startDate && endDate) {
            result = result.filter(b => {
                const date = parseISO(b.created_at);
                return isWithinInterval(date, {
                    start: parseISO(startDate + 'T00:00:00'),
                    end: parseISO(endDate + 'T23:59:59')
                });
            });
        }

        // Search Filter
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            result = result.filter(b => 
                b.passenger_name.toLowerCase().includes(q) || 
                b.tujuan.toLowerCase().includes(q) ||
                b.buses?.kode.toLowerCase().includes(q)
            );
        }

        setFilteredBookings(result);
    }, [bookings, startDate, endDate, searchTerm]);

    const totalRevenue = filteredBookings.reduce((sum, b) => sum + b.harga, 0);

    return (
        <div style={{ background: '#F8FAFC', minHeight: '100vh', paddingBottom: 100, fontFamily: 'sans-serif' }}>
            {/* Premium Header with Mesh Gradient */}
            <div style={{ 
                background: 'linear-gradient(135deg, #8B1A1A 0%, #B03A2E 100%)', 
                padding: 'calc(24px + env(safe-area-inset-top)) 20px 40px',
                borderRadius: '0 0 32px 32px',
                boxShadow: '0 10px 30px rgba(139, 26, 26, 0.2)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Decorative blobs */}
                <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
                
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <button 
                            onClick={() => router.push('/armada')}
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 12, width: 40, height: 40, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>Laporan Penjualan</h1>
                    </div>
                    
                    {agent && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: 20, backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ width: 44, height: 44, background: 'white', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <User size={22} color="#8B1A1A" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{agent.name}</p>
                                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{agent.location}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Summary Cards */}
            <div style={{ padding: '0 20px', marginTop: -25, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 12px 30px rgba(0,0,0,0.05)', border: '1px solid white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, background: '#F0FDF4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Wallet size={16} color="#16A34A" />
                        </div>
                        <p style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>OMSET</p>
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B' }}>{formatCurrency(totalRevenue)}</h2>
                </div>
                <div style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 12px 30px rgba(0,0,0,0.05)', border: '1px solid white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, background: '#EFF6FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BarChart3 size={16} color="#2563EB" />
                        </div>
                        <p style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>TICKET</p>
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B' }}>{filteredBookings.length}</h2>
                </div>
            </div>

            {/* Filter Section */}
            <div style={{ padding: '24px 20px 0' }}>
                <div style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Filter size={18} color="#8B1A1A" />
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>Filter Laporan</p>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' }}>Dari Tanggal</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={e => setStartDate(e.target.value)} 
                                    style={{ width: '100%', padding: '10px 10px 10px 34px', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 13, color: '#1E293B', outline: 'none' }} 
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' }}>Sampai</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={e => setEndDate(e.target.value)} 
                                    style={{ width: '100%', padding: '10px 10px 10px 34px', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 13, color: '#1E293B', outline: 'none' }} 
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                        <input 
                            type="text" 
                            placeholder="Cari nama penumpang atau rute..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 14, border: '1px solid #F1F5F9', background: '#F8FAFC', fontSize: 14, color: '#1E293B', outline: 'none' }} 
                        />
                    </div>
                </div>
            </div>

            {/* List Section */}
            <div style={{ padding: '24px 20px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {loading ? 'Mengambil data...' : `Ditemukan ${filteredBookings.length} Pesanan`}
                    </p>
                    <button 
                        onClick={() => {
                            setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                            setEndDate(format(new Date(), 'yyyy-MM-dd'));
                            setSearchTerm('');
                        }}
                        style={{ border: 'none', background: 'none', color: '#8B1A1A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                        Reset Filter
                    </button>
                </div>
                
                {loading ? (
                    <div style={{ padding: '60px 0', textAlign: 'center' }}>
                        <div style={{ width: 40, height: 40, border: '4px solid #F1F5F9', borderTopColor: '#8B1A1A', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
                        <p style={{ color: '#94A3B8', fontSize: 14 }}>Sedang memuat riwayat...</p>
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : filteredBookings.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: 28, padding: '60px 30px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                        <div style={{ width: 70, height: 70, background: '#F8FAFC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <BarChart3 size={32} color="#CBD5E1" />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>Tidak Ada Data</h3>
                        <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>Coba ubah filter tanggal atau kata kunci pencarian Anda.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {filteredBookings.map((b) => (
                            <div key={b.id} style={{ 
                                background: 'white', 
                                borderRadius: 24, 
                                overflow: 'hidden',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                                border: '1px solid white',
                                transition: 'transform 0.2s'
                            }}>
                                <div style={{ background: '#F1F5F9', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Calendar size={12} color="#64748B" />
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                                            {format(new Date(b.created_at), "d MMM yyyy • HH:mm", { locale: idLocale })}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: '#16A34A', background: '#DCFCE7', padding: '4px 10px', borderRadius: 10 }}>Confirmed</span>
                                </div>
                                
                                <div style={{ padding: '16px 20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                        <div>
                                            <p style={{ fontSize: 17, fontWeight: 800, color: '#1E293B' }}>{b.passenger_name}</p>
                                            <p style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>ID: #{b.id.slice(0, 8).toUpperCase()}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: 18, fontWeight: 900, color: '#8B1A1A' }}>{formatCurrency(b.harga)}</p>
                                            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Tunai</p>
                                        </div>
                                    </div>

                                    <div style={{ background: '#F8FAFC', borderRadius: 16, padding: '14px', position: 'relative' }}>
                                        {/* Connecting dash */}
                                        <div style={{ position: 'absolute', left: 24, top: 38, bottom: 38, borderLeft: '1.5px dashed #CBD5E1' }} />
                                        
                                        <div style={{ display: 'flex', alignItems: 'start', gap: 14, marginBottom: 12 }}>
                                            <div style={{ width: 8, height: 8, background: '#8B1A1A', borderRadius: '50%', marginTop: 6, zIndex: 1 }} />
                                            <div>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 2 }}>ARMADA</p>
                                                <p style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>{b.buses?.kode} — Kursi No. {b.nomor_kursi}</p>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', alignItems: 'start', gap: 14 }}>
                                            <div style={{ width: 8, height: 8, background: '#16A34A', borderRadius: '50%', marginTop: 6, zIndex: 1 }} />
                                            <div>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 2 }}>DESTINASI</p>
                                                <p style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>{b.tujuan}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => router.push(`/armada/${b.bus_id}`)}
                                        style={{ 
                                            width: '100%', 
                                            marginTop: 16, 
                                            padding: '12px', 
                                            borderRadius: 14, 
                                            background: '#F1F5F9', 
                                            border: 'none', 
                                            color: '#64748B', 
                                            fontSize: 13, 
                                            fontWeight: 700, 
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6
                                        }}
                                    >
                                        Lihat Tiket <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Premium Bottom Nav */}
            <nav style={{ 
                position: 'fixed', 
                bottom: 20, 
                left: 20, 
                right: 20, 
                background: 'rgba(255, 255, 255, 0.95)', 
                backdropFilter: 'blur(15px)',
                borderRadius: '24px', 
                height: 70, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-around',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                border: '1px solid rgba(255,255,255,0.5)',
                zIndex: 100
            }}>
                <div onClick={() => router.push('/armada')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#CBD5E1' }}>
                    <BusIcon size={22} />
                    <span style={{ fontSize: 10, fontWeight: 600 }}>Armada</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#CBD5E1' }}>
                    <QrCode size={22} />
                    <span style={{ fontSize: 10, fontWeight: 600 }}>QR</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#8B1A1A' }}>
                    <div style={{ position: 'relative' }}>
                        <BarChart3 size={24} />
                        <div style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: '#8B1A1A', borderRadius: '50%', border: '2px solid white' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800 }}>Laporan</span>
                </div>
                <div onClick={() => router.push('/admin')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#CBD5E1' }}>
                    <User size={22} />
                    <span style={{ fontSize: 10, fontWeight: 600 }}>Admin</span>
                </div>
            </nav>
        </div>
    );
}
