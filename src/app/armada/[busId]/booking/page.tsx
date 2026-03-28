'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { X, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { getAgentSession, formatCurrency } from '@/lib/utils';
import { createBooking, releaseSeat } from '@/lib/db';
import type { Bus, Route } from '@/types';
import { supabase } from '@/lib/supabase';

interface PassengerForm {
    seatId: string;
    nomor: number;
    passengerName: string;
    passengerPhone: string;
    catatan: string;
}

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

    const [routeId, setRouteId] = useState('');
    const [tujuan, setTujuan] = useState('');
    const [harga, setHarga] = useState(0);
    const [seatIds, setSeatIds] = useState<string[]>([]);
    const [seatNomors, setSeatNomors] = useState<number[]>([]);

    useEffect(() => {
        const idsRaw = searchParams.get('seatIds') || searchParams.get('seatId') || '';
        const nomorsRaw = searchParams.get('nomors') || searchParams.get('nomor') || '';
        setSeatIds(idsRaw.split(',').filter(Boolean));
        setSeatNomors(nomorsRaw.split(',').map(Number).filter(Boolean));
        setRouteId(searchParams.get('routeId') || '');
        setTujuan(searchParams.get('tujuan') || '');
        setHarga(parseInt(searchParams.get('harga') || '0'));
    }, [searchParams]);

    const [agent, setAgent] = useState<{ name: string; location: string; phone: string } | null>(null);
    const [bus, setBus] = useState<Bus | null>(null);
    const [route, setRoute] = useState<Route | null>(null);
    const [forms, setForms] = useState<PassengerForm[]>([]);
    const [currentFormIndex, setCurrentFormIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showCost, setShowCost] = useState(false);
    const isSubmitted = React.useRef(false);

    // Initialize forms when seatIds/seatNomors are ready
    useEffect(() => {
        if (seatIds.length === 0) return;
        setForms(seatIds.map((id, i) => ({
            seatId: id,
            nomor: seatNomors[i] || i + 1,
            passengerName: '',
            passengerPhone: '',
            catatan: '',
        })));
        setCurrentFormIndex(0);
    }, [seatIds.join(','), seatNomors.join(',')]);

    // Release all seats if leaving without buying
    useEffect(() => {
        return () => {
            if (!isSubmitted.current) {
                seatIds.forEach(id => releaseSeat(id).catch(() => {}));
            }
        };
    }, [seatIds]);

    useEffect(() => {
        const session = getAgentSession();
        if (!session) { router.replace('/'); return; }
        setAgent(session);

        if (!busId || !routeId) return;

        Promise.all([
            supabase.from('buses').select('*').eq('id', busId).single(),
            supabase.from('routes').select('*, via_stops').eq('id', routeId).single(),
        ]).then(([busRes, routeRes]) => {
            if (busRes.data) setBus(busRes.data as Bus);
            if (routeRes.data) setRoute(routeRes.data as Route);
        });
    }, [busId, routeId, router]);

    function updateForm(index: number, field: keyof PassengerForm, value: string) {
        setForms(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
    }

    const currentForm = forms[currentFormIndex];
    const isCurrentFormValid = currentForm?.passengerName.trim() && currentForm?.passengerPhone.trim();
    const isLastForm = currentFormIndex === forms.length - 1;
    const allFormsCompleted = forms.every(f => f.passengerName.trim() && f.passengerPhone.trim());

    async function handleBuyAll() {
        if (!agent || !allFormsCompleted) return;
        setLoading(true);
        setError('');
        try {
            const results = [];
            for (const form of forms) {
                const result = await createBooking({
                    seat_id: form.seatId,
                    route_id: routeId,
                    bus_id: busId,
                    nomor_kursi: form.nomor,
                    agent_name: agent.name,
                    agent_location: agent.location,
                    agent_phone: agent.phone,
                    passenger_name: form.passengerName.trim(),
                    passenger_phone: form.passengerPhone.trim(),
                    tujuan,
                    harga,
                    catatan: form.catatan.trim(),
                });
                if (!result.success) {
                    setError(`Kursi ${form.nomor}: ${result.message}`);
                    setLoading(false);
                    return;
                }
                results.push(result);
            }

            isSubmitted.current = true;

            // Navigate to success page with the first booking's ID and summary
            const firstResult = results[0];
            const allNomors = forms.map(f => f.nomor).join(',');
            const allPassengers = forms.map(f => f.passengerName).join(';');
            const totalHarga = harga * forms.length;

            router.replace(
                `/armada/${busId}/booking/success` +
                `?bookingId=${firstResult.booking?.id || ''}` +
                `&nomor=${allNomors}` +
                `&tujuan=${encodeURIComponent(tujuan)}` +
                `&passenger=${encodeURIComponent(allPassengers)}` +
                `&phone=${encodeURIComponent(forms[0].passengerPhone)}` +
                `&harga=${totalHarga}` +
                `&busKode=${encodeURIComponent(bus?.kode || '')}` +
                `&busArah=${encodeURIComponent(bus?.arah || '')}` +
                `&busNama=${encodeURIComponent(bus?.nama || '')}` +
                `&jamBerangkat=${encodeURIComponent(bus?.jam_berangkat || '')}` +
                `&kotaAsal=${encodeURIComponent(route?.kota_asal || '')}` +
                `&kotaTujuan=${encodeURIComponent(route?.kota_tujuan || '')}` +
                `&agentName=${encodeURIComponent(agent?.name || '')}` +
                `&agentLocation=${encodeURIComponent(agent?.location || '')}` +
                `&count=${forms.length}`
            );
        } catch {
            setError('Terjadi kesalahan. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    }

    const totalHarga = harga * forms.length;

    return (
        <div style={{ background: 'var(--gray-bg)', minHeight: '100vh' }}>

            {/* Header */}
            <div style={{ background: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50 }}>
                <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={20} color="#333" />
                </button>
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>Form Pemesanan</p>
                    {forms.length > 1 && (
                        <p style={{ fontSize: 12, color: '#888' }}>{forms.length} kursi • Total {formatCurrency(totalHarga)}</p>
                    )}
                </div>
            </div>

            {/* Bus Info */}
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

            {/* Tujuan & Harga */}
            <div style={{ background: 'white', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: '#555' }}>{tujuan}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{formatCurrency(harga)}/kursi</span>
            </div>

            {/* Seat tabs (if multi-seat) */}
            {forms.length > 1 && (
                <div style={{ background: 'white', padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 8 }}>
                    {forms.map((f, i) => (
                        <button
                            key={f.seatId}
                            onClick={() => setCurrentFormIndex(i)}
                            style={{
                                flexShrink: 0,
                                padding: '8px 14px',
                                borderRadius: 20,
                                border: '1.5px solid ' + (currentFormIndex === i ? '#8B1A1A' : '#ddd'),
                                background: currentFormIndex === i ? '#8B1A1A' : 'white',
                                color: currentFormIndex === i ? 'white' : '#555',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                position: 'relative',
                            }}
                        >
                            Kursi {f.nomor}
                            {f.passengerName.trim() && (
                                <span style={{
                                    position: 'absolute', top: -4, right: -4,
                                    width: 10, height: 10, background: '#2E7D32', borderRadius: '50%',
                                    border: '1px solid white'
                                }} />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Current Passenger Form */}
            {currentForm && (
                <div style={{ background: 'white', padding: '0 0 8px', marginBottom: 8 }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
                            Penumpang - Kursi <span style={{ color: '#8B1A1A' }}>{currentForm.nomor}</span>
                        </p>
                    </div>

                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <input
                            className="input-field"
                            type="text"
                            placeholder="Nama lengkap penumpang"
                            value={currentForm.passengerName}
                            onChange={e => updateForm(currentFormIndex, 'passengerName', e.target.value)}
                            autoFocus
                        />
                        <input
                            className="input-field"
                            type="tel"
                            placeholder="No HP WhatsApp (contoh: 08123456789)"
                            value={currentForm.passengerPhone}
                            onChange={e => updateForm(currentFormIndex, 'passengerPhone', e.target.value)}
                        />
                    </div>

                    <div style={{ padding: '0 16px 16px' }}>
                        <fieldset className="fieldset-label">
                            <legend>Catatan</legend>
                            <textarea
                                style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', minHeight: 60, fontSize: 14, fontFamily: 'Inter, sans-serif', color: '#333', marginTop: 4, background: 'transparent' }}
                                placeholder=""
                                value={currentForm.catatan}
                                onChange={e => updateForm(currentFormIndex, 'catatan', e.target.value)}
                            />
                        </fieldset>
                    </div>

                    {/* Next Passenger Button (if multi-seat and not last) */}
                    {forms.length > 1 && !isLastForm && (
                        <div style={{ padding: '0 16px' }}>
                            <button
                                onClick={() => isCurrentFormValid && setCurrentFormIndex(prev => prev + 1)}
                                disabled={!isCurrentFormValid}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: 12,
                                    background: isCurrentFormValid ? '#f0f0f0' : '#f5f5f5',
                                    border: 'none',
                                    color: isCurrentFormValid ? '#333' : '#bbb',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: isCurrentFormValid ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}
                            >
                                Penumpang Berikutnya (Kursi {forms[currentFormIndex + 1]?.nomor}) <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Summary all passengers if multi-seat */}
            {forms.length > 1 && (
                <div style={{ background: 'white', padding: '12px 16px', marginBottom: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>Ringkasan Penumpang</p>
                    {forms.map((f, i) => (
                        <div key={f.seatId} onClick={() => setCurrentFormIndex(i)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < forms.length - 1 ? '1px solid #f0f0f0' : 'none', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 30, height: 30, background: '#8B1A1A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ color: 'white', fontSize: 12, fontWeight: 800 }}>{f.nomor}</span>
                                </div>
                                <p style={{ fontSize: 14, color: f.passengerName ? '#1A1A1A' : '#bbb', fontWeight: f.passengerName ? 600 : 400 }}>
                                    {f.passengerName || 'Belum diisi'}
                                </p>
                            </div>
                            <span style={{ fontSize: 11, color: f.passengerName && f.passengerPhone ? '#2E7D32' : '#F39C12', fontWeight: 700 }}>
                                {f.passengerName && f.passengerPhone ? '✓ Siap' : 'Isi data'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ margin: '0 16px 8px', background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 8, padding: '12px 14px', color: '#C62828', fontSize: 13 }}>
                    ⚠️ {error}
                </div>
            )}

            <div style={{ height: 120 }} />

            {/* Bottom Bar */}
            <div className="bottom-bar" style={{ flexDirection: 'column', gap: 0, padding: '0' }}>
                {showCost && (
                    <div style={{ width: '100%', background: '#f9f9f9', borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                        {forms.map((f, i) => (
                            <div key={f.seatId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                <span style={{ color: '#888' }}>Kursi {f.nomor}</span>
                                <span>{formatCurrency(harga)}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '1px solid #eee', paddingTop: 8, marginTop: 4 }}>
                            <span>Total ({forms.length} kursi)</span>
                            <span style={{ color: '#8B1A1A' }}>{formatCurrency(totalHarga)}</span>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', gap: 12 }}>
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

                    <span style={{ fontSize: 16, fontWeight: 700, flex: 1, color: '#1A1A1A' }}>
                        {formatCurrency(totalHarga)}
                    </span>

                    <button
                        className="btn-primary"
                        style={{ width: 'auto', padding: '14px 28px', borderRadius: 10 }}
                        onClick={handleBuyAll}
                        disabled={loading || !allFormsCompleted}
                    >
                        {loading ? '...' : `BELI (${forms.length})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
