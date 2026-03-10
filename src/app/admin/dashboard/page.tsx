'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Bus, Map, FileText, LogOut, ChevronRight, Users, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState({ totalBus: 0, totalBooking: 0, totalRevenue: 0, bookedToday: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('admin_auth') !== 'true') {
            router.replace('/admin');
        }
    }, [router]);

    const fetchStats = useCallback(async () => {
        const today = new Date().toISOString().split('T')[0];
        const [busRes, bookingRes, todayRes] = await Promise.all([
            supabase.from('buses').select('id', { count: 'exact' }).eq('aktif', true),
            supabase.from('bookings').select('harga').eq('status', 'confirmed'),
            supabase.from('bookings').select('id', { count: 'exact' }).eq('status', 'confirmed').gte('created_at', `${today}T00:00:00`),
        ]);
        const revenue = (bookingRes.data || []).reduce((s, b) => s + b.harga, 0);
        setStats({
            totalBus: busRes.count || 0,
            totalBooking: bookingRes.data?.length || 0,
            totalRevenue: revenue,
            bookedToday: todayRes.count || 0,
        });
        setLoading(false);
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    function logout() {
        sessionStorage.removeItem('admin_auth');
        router.push('/admin');
    }

    const menuItems = [
        { icon: Bus, label: 'Manajemen Bus', desc: 'Tambah/edit/hapus armada', href: '/admin/buses', color: '#8B1A1A' },
        { icon: Map, label: 'Manajemen Rute', desc: 'Rute, stops, harga tiket', href: '/admin/routes', color: '#1565C0' },
        { icon: FileText, label: 'Laporan Booking', desc: 'Semua pemesanan & kirim WA', href: '/admin/bookings', color: '#2E7D32' },
        { icon: Users, label: 'Manifest Penumpang', desc: 'Daftar penumpang per bus', href: '/admin/manifest', color: '#E65100' },
    ];

    return (
        <div style={{ background: '#F8F9FA', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #8B1A1A 0%, #6B1414 100%)',
                padding: 'calc(20px + env(safe-area-inset-top)) 20px 30px',
                borderRadius: '0 0 24px 24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Panel Admin</p>
                        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'white', marginTop: 4 }}>Dashboard</h1>
                    </div>
                    <button
                        onClick={logout}
                        style={{
                            background: 'rgba(255,255,255,0.15)',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '10px 16px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                        }}
                    >
                        <LogOut size={16} /> Keluar
                    </button>
                </div>
            </div>

            {/* Consolidated Overview Card */}
            <div style={{ padding: '0 20px', marginTop: -20 }}>
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '24px 20px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '24px 20px'
                }}>
                    {[
                        { label: 'Armada Aktif', value: stats.totalBus, color: '#C0392B', icon: '🚌' },
                        { label: 'Booking Hari Ini', value: stats.bookedToday, color: '#2980B9', icon: '📅' },
                        { label: 'Total Booking', value: stats.totalBooking, color: '#27AE60', icon: '🎫' },
                        { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), color: '#D35400', icon: '💰' },
                    ].map((s, idx) => (
                        <div key={s.label} style={{
                            borderRight: idx % 2 === 0 ? '1px solid #F0F0F0' : 'none',
                            paddingRight: idx % 2 === 0 ? 10 : 0
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ fontSize: 16 }}>{s.icon}</span>
                                <p style={{ fontSize: 11, color: '#AAA', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
                            </div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0 }}>
                                {loading ? '...' : s.value}
                            </h3>
                        </div>
                    ))}
                </div>
            </div>

            {/* Menu List */}
            <div style={{ padding: '30px 20px 40px' }}>
                <p style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: '#AAA',
                    fontWeight: 700,
                    marginBottom: 16,
                    paddingLeft: 4
                }}>Menu</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {menuItems.map(item => (
                        <div
                            key={item.href}
                            style={{
                                background: 'white',
                                borderRadius: '18px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                cursor: 'pointer',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => router.push(item.href)}
                        >
                            <div style={{
                                width: 50,
                                height: 50,
                                background: `${item.color}10`,
                                borderRadius: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <item.icon size={26} color={item.color} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{item.label}</p>
                                <p style={{ fontSize: 13, color: '#888', marginTop: 4, margin: 0 }}>{item.desc}</p>
                            </div>
                            <ChevronRight size={20} color="#DDD" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
