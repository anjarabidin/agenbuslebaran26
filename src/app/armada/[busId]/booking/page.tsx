'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { X, ChevronDown, QrCode, Copy, ChevronUp } from 'lucide-react';
import { getAgentSession, formatCurrency } from '@/lib/utils';
import { createBooking } from '@/lib/db';
import type { Bus, Route } from '@/types';
import { supabase } from '@/lib/supabase';

export default function BookingPage() {
    return (
        <Suspense fallback={<div style={{ padding: 20, textAlign: 'center' }}>Memuat form...</div>}>
            <BookingPageContent />
        </Suspense>
    );
}

function BookingPageContent() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const busId = params.busId as string;

    // State dependen searchParams
    const [seatId, setSeatId] = useState('');
    const [routeId, setRouteId] = useState('');
    const [tujuan, setTujuan] = useState('');
    const [harga, setHarga] = useState(0);
    const [nomor, setNomor] = useState(0);

    useEffect(() => {
        setSeatId(searchParams.get('seatId') || '');
        setRouteId(searchParams.get('routeId') || '');
        setTujuan(searchParams.get('tujuan') || '');
        setHarga(parseInt(searchParams.get('harga') || '0'));
        setNomor(parseInt(searchParams.get('nomor') || '0'));
    }, [searchParams]);

    const [agent, setAgent] = useState<{ name: string; location: string; phone: string } | null>(null);
    const [bus, setBus] = useState<Bus | null>(null);
    const [route, setRoute] = useState<Route | null>(null);
    const [passengerName, setPassengerName] = useState('');
    const [passengerPhone, setPassengerPhone] = useState('');
    const [catatan, setCatatan] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showCost, setShowCost] = useState(false);
    const [showPassengerInput, setShowPassengerInput] = useState(false);

    useEffect(() => {
        const session = getAgentSession();
        if (!session) { router.replace('/'); return; }
        setAgent(session);

        Promise.all([
            supabase.from('buses').select('*').eq('id', busId).single(),
            supabase.from('routes').select('*, via_stops').eq('id', routeId).single(),
        ]).then(([busRes, routeRes]) => {
            if (busRes.data) setBus(busRes.data as Bus);
            if (routeRes.data) setRoute(routeRes.data as Route);
        });
    }, [busId, routeId, router]);

    async function handleBuy() {
        if (!agent || !passengerName.trim() || !passengerPhone.trim()) return;
        setLoading(true);
        setError('');
        try {
            const result = await createBooking({
                seat_id: seatId,
                route_id: routeId,
                bus_id: busId,
                nomor_kursi: nomor,
                agent_name: agent.name,
                agent_location: agent.location,
                agent_phone: agent.phone,  // No WA agen
                passenger_name: passengerName.trim(),
                passenger_phone: passengerPhone.trim(),
                tujuan,
                harga,
                catatan: catatan.trim(),
            });

            if (!result.success) {
                setError(result.message);
                return;
            }

            router.replace(
                `/armada/${busId}/booking/success` +
                `?bookingId=${result.booking?.id || ''}` +
                `&nomor=${nomor}` +
                `&tujuan=${encodeURIComponent(tujuan)}` +
                `&passenger=${encodeURIComponent(passengerName)}` +
                `&phone=${encodeURIComponent(passengerPhone)}` +
                `&harga=${harga}` +
                `&busKode=${encodeURIComponent(bus?.kode || '')}` +
                `&busArah=${encodeURIComponent(bus?.arah || '')}` +
                `&busNama=${encodeURIComponent(bus?.nama || '')}` +
                `&jamBerangkat=${encodeURIComponent(bus?.jam_berangkat || '')}` +
                `&kotaAsal=${encodeURIComponent(route?.kota_asal || '')}` +
                `&kotaTujuan=${encodeURIComponent(route?.kota_tujuan || '')}` +
                `&agentName=${encodeURIComponent(agent?.name || '')}` +
                `&agentLocation=${encodeURIComponent(agent?.location || '')}`
            );
        } catch {
            setError('Terjadi kesalahan. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ background: 'var(--gray-bg)', minHeight: '100vh' }}>

            {/* ===== HEADER (sesuai gambar 5: X di pojok kiri atas) ===== */}
            <div style={{ background: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50 }}>
                <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={20} color="#333" />
                </button>
            </div>

            {/* ===== BUS INFO (sesuai gambar 5) ===== */}
            {bus && (
                <div style={{ background: 'white', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <p style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>{bus.arah} / {bus.kode}</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: route?.via_stops?.length ? 4 : 0 }}>
                        {agent ? bus.nama.replace(/^[^-]+/, agent.location) : bus.nama}
                    </p>
                    {route?.via_stops && route.via_stops.length > 0 && (
                        <p style={{ fontSize: 11, color: '#999', lineHeight: 1.5 }}>
                            {route.via_stops.join(' - ')}
                        </p>
                    )}
                </div>
            )}

            {/* ===== TUJUAN + HARGA (sesuai gambar 5) ===== */}
            <div style={{ background: 'white', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: '#555' }}>{tujuan}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{formatCurrency(harga)}</span>
            </div>

            {/* ===== FORM (sesuai gambar 5) ===== */}
            <div style={{ background: 'white', padding: '0 0 8px' }}>

                {/* "Penumpang 1" - dropdown style (sesuai gambar 5) */}
                {/* Tampilan: kiri "Penumpang 1" (bold) + chevron down, kanan: icon QR + icon copy */}
                <div
                    style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    onClick={() => setShowPassengerInput(!showPassengerInput)}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Penumpang {nomor || 1}</span>
                        <ChevronDown
                            size={16}
                            color="#888"
                            style={{ transform: showPassengerInput ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {/* Icon QR (sesuai gambar 5) */}
                        <div style={{ width: 36, height: 36, border: '1.5px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <QrCode size={18} color="#555" />
                        </div>
                        {/* Icon Copy (sesuai gambar 5) */}
                        <div style={{ width: 36, height: 36, border: '1.5px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Copy size={18} color="#555" />
                        </div>
                    </div>
                </div>

                {/* Input fields (muncul saat di-expand) */}
                {(showPassengerInput || true) && (
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <input
                            className="input-field"
                            type="text"
                            placeholder="Nama lengkap penumpang"
                            value={passengerName}
                            onChange={e => setPassengerName(e.target.value)}
                            autoFocus
                        />
                        <input
                            className="input-field"
                            type="tel"
                            placeholder="No HP WhatsApp (contoh: 08123456789)"
                            value={passengerPhone}
                            onChange={e => setPassengerPhone(e.target.value)}
                        />
                    </div>
                )}

                {/* Catatan (sesuai gambar 5: fieldset dengan legend "Catatan") */}
                <div style={{ padding: '0 16px 16px' }}>
                    <fieldset className="fieldset-label">
                        <legend>Catatan</legend>
                        <textarea
                            style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', minHeight: 80, fontSize: 14, fontFamily: 'Inter, sans-serif', color: '#333', marginTop: 4, background: 'transparent' }}
                            placeholder=""
                            value={catatan}
                            onChange={e => setCatatan(e.target.value)}
                        />
                    </fieldset>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{ margin: '0 16px 8px', background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '12px 14px', color: '#C62828', fontSize: 13 }}>
                    ⚠️ {error}
                </div>
            )}

            <div style={{ height: 100 }} />

            {/* ===== BOTTOM BAR (sesuai gambar 5: ↑ RINCIAN BIAYA | harga | BELI) ===== */}
            <div className="bottom-bar" style={{ flexDirection: 'column', gap: 0, padding: '0' }}>
                {/* Rincian biaya panel (muncul saat diklik) */}
                {showCost && (
                    <div style={{ width: '100%', background: '#f9f9f9', borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                            <span style={{ color: '#888' }}>Harga Tiket</span>
                            <span>{formatCurrency(harga)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '1px solid #eee', paddingTop: 8 }}>
                            <span>Total</span>
                            <span style={{ color: '#8B1A1A' }}>{formatCurrency(harga)}</span>
                        </div>
                    </div>
                )}

                {/* Bottom action row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', gap: 12 }}>
                    {/* Rincian biaya toggle */}
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', minWidth: 0, flex: '0 0 auto' }}
                        onClick={() => setShowCost(!showCost)}
                    >
                        <ChevronUp
                            size={14}
                            color="#555"
                            style={{ transform: showCost ? 'rotate(180deg)' : 'none', transition: '0.2s', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 11, color: '#555', fontWeight: 600, whiteSpace: 'nowrap' }}>RINCIAN BIAYA</span>
                    </div>

                    {/* Harga */}
                    <span style={{ fontSize: 16, fontWeight: 700, flex: 1, color: '#1A1A1A' }}>
                        {formatCurrency(harga)}
                    </span>

                    {/* BELI button */}
                    <button
                        className="btn-primary"
                        style={{ width: 'auto', padding: '14px 28px', borderRadius: 10 }}
                        onClick={handleBuy}
                        disabled={loading || !passengerName.trim() || !passengerPhone.trim()}
                    >
                        {loading ? '...' : 'BELI'}
                    </button>
                </div>
            </div>
        </div>
    );
}
