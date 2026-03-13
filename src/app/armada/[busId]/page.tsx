'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ChevronRight, ChevronDown, X, CalendarDays, MessageCircle, ArrowRightLeft, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { getAgentSession, formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Bus, Route, RoutePrice, Booking } from '@/types';

type ActiveTab = 'pembelian' | 'manifest' | 'paket';

// ===== Komponen Popup Detail Penumpang =====
function PassengerPopup({
    booking,
    onClose,
}: {
    booking: Booking;
    onClose: () => void;
}) {
    function handleWA() {
        const cleaned = booking.passenger_phone.replace(/\D/g, '').replace(/^0/, '62');
        const msg =
            `🎫 *TIKET BUS*\n` +
            `━━━━━━━━━━━━━━\n` +
            `💺 Kursi No. ${booking.nomor_kursi}\n` +
            `👤 ${booking.passenger_name}\n` +
            `📞 ${booking.passenger_phone}\n` +
            `📌 Tujuan: ${booking.tujuan}\n` +
            `💰 ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(booking.harga)}\n` +
            `━━━━━━━━━━━━━━\n` +
            `🏪 Agen: ${booking.agent_name}\n` +
            `Terima kasih! 🙏`;
        window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }} />
            <div style={{
                position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: '100%', maxWidth: 480, background: 'white',
                borderRadius: '20px 20px 0 0',
                padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
                zIndex: 201, boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
                animation: 'slideUp 0.25s ease-out',
            }}>
                <div style={{ width: 40, height: 4, background: '#e0e0e0', borderRadius: 2, margin: '0 auto 18px' }} />

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 44, height: 44, background: '#8B1A1A', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>{booking.nomor_kursi}</span>
                        </div>
                        <div>
                            <p style={{ fontSize: 16, fontWeight: 800 }}>{booking.passenger_name}</p>
                            <p style={{ fontSize: 12, color: '#888' }}>{booking.passenger_phone}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
                        <X size={18} color="#555" />
                    </button>
                </div>

                {/* Detail */}
                <div style={{ background: '#fafafa', borderRadius: 14, padding: '14px 16px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                        { label: 'Tujuan', value: booking.tujuan },
                        { label: 'Harga', value: formatCurrency(booking.harga) },
                        { label: 'Agen', value: `${booking.agent_name} • ${booking.agent_location}` },
                        ...(booking.catatan ? [{ label: 'Catatan', value: booking.catatan }] : []),
                    ].map(item => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: '#888' }}>{item.label}</span>
                            <span style={{ fontWeight: 600, color: '#333', textAlign: 'right', maxWidth: '60%' }}>{item.value}</span>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Kirim nota via WA */}
                    <button
                        onClick={handleWA}
                        style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                        <MessageCircle size={18} /> Cetak Nota via WhatsApp
                    </button>
                    <button onClick={onClose} className="btn-secondary">Tutup</button>
                </div>
            </div>
            <style>{`@keyframes slideUp { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }`}</style>
        </>
    );
}

// ===== Main Page =====
// ===== Wrapper to handle Suspense =====
export default function BusDetailPage() {
    return (
        <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Memuat halaman...</div>}>
            <BusDetailContent />
        </Suspense>
    );
}

function BusDetailContent() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const busId = params.busId as string;

    const [date, setDate] = useState<string>(''); // Init empty for hydration
    const [agent, setAgent] = useState<{ name: string; location: string } | null>(null);
    const [bus, setBus] = useState<Bus | null>(null);
    const [routes, setRoutes] = useState<(Route & { route_prices: RoutePrice[] })[]>([]);
    const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('pembelian');

    useEffect(() => {
        // Initialize date and tab on client only
        const dateParam = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
        setDate(dateParam);

        const tab = searchParams.get('tab') as ActiveTab;
        if (tab) setActiveTab(tab);
    }, [searchParams]);
    const [manifests, setManifests] = useState<Booking[]>([]);
    const [seatCounts, setSeatCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    // Popup state
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    useEffect(() => {
        const session = getAgentSession();
        if (!session) { router.replace('/'); return; }
        setAgent(session);
    }, [router]);

    const fetchData = useCallback(async () => {
        if (!date) return; // Wait for date to be set
        setLoading(true);
        try {
            const [busRes, routesRes] = await Promise.all([
                supabase.from('buses').select('*').eq('id', busId).single(),
                supabase.from('routes').select('*, route_prices(*)').eq('bus_id', busId),
            ]);
            if (busRes.data) setBus(busRes.data as Bus);
            if (routesRes.data) {
                const rts = routesRes.data as (Route & { route_prices: RoutePrice[] })[];
                setRoutes(rts);
                const counts: Record<string, number> = {};
                await Promise.all(rts.map(async (r) => {
                    const { count } = await supabase
                        .from('seats').select('*', { count: 'exact', head: true })
                        .eq('route_id', r.id).eq('status', 'available');
                    counts[r.id] = count || 0;
                }));
                setSeatCounts(counts);
            }
        } finally {
            setLoading(false);
        }
    }, [busId, date]);

    const fetchManifest = useCallback(async () => {
        const { data } = await supabase
            .from('bookings').select('*')
            .eq('bus_id', busId).eq('status', 'confirmed')
            .order('nomor_kursi');
        if (data) setManifests(data as Booking[]);
    }, [busId]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => {
        if (activeTab === 'manifest') fetchManifest();
    }, [activeTab, fetchManifest]);

    // Realtime refresh manifest saat ada perubahan booking
    useEffect(() => {
        if (activeTab !== 'manifest') return;
        const ch = supabase.channel(`manifest:${busId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `bus_id=eq.${busId}` },
                () => fetchManifest())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [activeTab, busId, fetchManifest]);

    const displayDate = date ? format(new Date(date + 'T00:00:00'), "EEEE, d MMMM yyyy", { locale: idLocale }) : '';

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="animate-pulse" style={{ color: '#aaa' }}>Memuat...</div>
        </div>
    );

    return (
        <div style={{ background: 'var(--gray-bg)', minHeight: '100vh' }}>
            {/* Header Tabs */}
            <div style={{ background: 'var(--maroon)', paddingTop: 'env(safe-area-inset-top)' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '14px 12px 0', gap: 4 }}>
                    {[
                        { key: 'pembelian', label: 'Pembelian Tiket' },
                        { key: 'manifest', label: 'Manifest' },
                        { key: 'paket', label: 'Paket Armada' },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key as ActiveTab)} style={{
                            border: 'none', cursor: 'pointer',
                            padding: '10px 14px',
                            borderRadius: activeTab === tab.key ? 50 : 0,
                            background: activeTab === tab.key ? 'white' : 'transparent',
                            color: activeTab === tab.key ? 'var(--maroon)' : 'rgba(255,255,255,0.8)',
                            fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 500,
                            fontFamily: 'Inter, sans-serif', transition: 'all 0.2s', whiteSpace: 'nowrap',
                        }}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Date Bar */}
            <div style={{ background: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>{displayDate}</span>
                <CalendarDays size={18} color="#aaa" />
            </div>

            {/* Bus Info */}
            {bus && (
                <div style={{ background: 'white', padding: '14px 16px', marginBottom: 2 }}>
                    <p style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 3 }}>{bus.arah} / {bus.kode}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>{bus.nama}</p>
                    {routes[0]?.via_stops && routes[0].via_stops.length > 0 && (
                        <p style={{ fontSize: 12, color: '#999' }}>{routes[0].via_stops.join(' - ')}</p>
                    )}
                </div>
            )}

            {/* TAB: Pembelian Tiket */}
            {activeTab === 'pembelian' && (
                <div style={{ paddingBottom: 24 }}>
                    {routes.length === 0 ? (
                        <div style={{ padding: '40px 16px', textAlign: 'center', color: '#aaa' }}>
                            <p>Belum ada rute untuk tanggal ini</p>
                        </div>
                    ) : (
                        routes.map(route => (
                            <div key={route.id}>
                                <div
                                    style={{ background: 'white', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                                    onClick={() => setExpandedRoute(expandedRoute === route.id ? null : route.id)}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                                            <span style={{ fontSize: 15, fontWeight: 700 }}>{bus?.jam_berangkat}</span>
                                            <span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>{agent?.name}</span>
                                        </div>
                                        {expandedRoute === route.id && (
                                            <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{agent?.location}</p>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 22, fontWeight: 700 }}>{seatCounts[route.id] ?? (bus?.kapasitas || 0)}</span>
                                        {expandedRoute === route.id ? <ChevronDown size={16} color="#888" /> : <ChevronRight size={16} color="#888" />}
                                    </div>
                                </div>
                                {expandedRoute === route.id && (
                                    <div className="animate-in">
                                        {route.route_prices?.map(price => (
                                            <div key={price.id}
                                                style={{ background: 'white', padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                                                onClick={() => router.push(`/armada/${busId}/seats?routeId=${route.id}&tujuan=${encodeURIComponent(price.tujuan)}&harga=${price.harga}&date=${date}`)}>
                                                <span style={{ fontSize: 14, color: '#333' }}>{route.kota_asal} - {price.tujuan}</span>
                                                <span style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(price.harga)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* TAB: Manifest - bisa diklik */}
            {activeTab === 'manifest' && (
                <div style={{ paddingBottom: 24 }}>
                    {manifests.length === 0 ? (
                        <div style={{ padding: '40px 16px', textAlign: 'center', color: '#aaa' }}>
                            <p>Belum ada penumpang terdaftar</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ padding: '10px 16px', fontSize: 12, color: '#666', background: '#f9f9f9', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Total {manifests.length} penumpang</span>
                                <span style={{ color: '#888' }}>Ketuk untuk detail penunpang</span>
                            </div>
                            {manifests.map(b => (
                                <div
                                    key={b.id}
                                    style={{ background: 'white', padding: '13px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                                    onClick={() => setSelectedBooking(b)}
                                >
                                    {/* Nomor kursi */}
                                    <div style={{ width: 36, height: 36, background: '#8B1A1A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ color: 'white', fontSize: 13, fontWeight: 800 }}>{b.nomor_kursi}</span>
                                    </div>
                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{b.passenger_name}</p>
                                        <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                                            {b.tujuan} • {b.agent_name}
                                        </p>
                                    </div>
                                    {/* Panah */}
                                    <ChevronRight size={16} color="#ccc" />
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* TAB: Paket Armada */}
            {activeTab === 'paket' && (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: '#aaa' }}>
                    <p>Fitur Paket Armada</p>
                    <p style={{ fontSize: 12, marginTop: 8 }}>Hubungi admin untuk info paket</p>
                </div>
            )}

            {/* Popup detail penumpang */}
            {selectedBooking && (
                <PassengerPopup
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                />
            )}
        </div>
    );
}
