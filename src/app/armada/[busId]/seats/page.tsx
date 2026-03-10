'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { X, AlertCircle, User, MapPin, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { getAgentSession, formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { getSeats, lockSeat, releaseSeat, moveBooking } from '@/lib/db';
import type { Seat, Bus, Booking } from '@/types';

// Popup info kursi terisi
function SeatInfoPopup({ seat, booking, onClose }: { seat: Seat; booking: Booking | null; onClose: () => void; }) {
    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }} />
            <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', zIndex: 201, boxShadow: '0 -8px 40px rgba(0,0,0,0.15)', animation: 'slideUp 0.25s ease-out' }}>
                <div style={{ width: 40, height: 4, background: '#e0e0e0', borderRadius: 2, margin: '0 auto 18px' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 44, height: 44, background: '#C0392B', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>{seat.nomor_kursi}</span>
                        </div>
                        <div>
                            <p style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A' }}>Kursi No. {seat.nomor_kursi}</p>
                            <span style={{ display: 'inline-block', background: '#FFEBEE', color: '#C0392B', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '2px 10px', marginTop: 2 }}>SUDAH TERISI</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={18} color="#555" /></button>
                </div>
                {booking ? (
                    <div style={{ background: '#fafafa', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 36, height: 36, background: '#8B1A1A15', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={18} color="#8B1A1A" />
                            </div>
                            <div>
                                <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Dipesan oleh Agen</p>
                                <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginTop: 2 }}>{booking.agent_name}</p>
                                <p style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{booking.agent_location}</p>
                            </div>
                        </div>
                        <div style={{ height: 1, background: '#efefef' }} />
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 36, height: 36, background: '#1565C015', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <MapPin size={18} color="#1565C0" />
                            </div>
                            <div>
                                <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Tujuan</p>
                                <p style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{booking.tujuan}</p>
                                <p style={{ fontSize: 12, color: '#2E7D32', fontWeight: 600, marginTop: 1 }}>{formatCurrency(booking.harga)}</p>
                            </div>
                        </div>
                        <div style={{ height: 1, background: '#efefef' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: '#888' }}>Penumpang</span>
                            <span style={{ fontWeight: 600 }}>{booking.passenger_name}</span>
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: 20, textAlign: 'center', color: '#aaa' }} className="animate-pulse">Memuat...</div>
                )}
                <button onClick={onClose} className="btn-secondary" style={{ marginTop: 14 }}>Tutup</button>
            </div>
            <style>{`@keyframes slideUp { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }`}</style>
        </>
    );
}

// Popup konfirmasi pindah kursi (verifikasi no WA agen)
function ConfirmMovePopup({
    fromNomor, toSeat, agentPhone,
    onConfirm, onCancel, loading, error,
}: {
    fromNomor: number; toSeat: Seat; agentPhone: string;
    onConfirm: (inputPhone: string) => void; onCancel: () => void;
    loading: boolean; error: string;
}) {
    const [inputPhone, setInputPhone] = useState('');
    return (
        <>
            <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
            <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', zIndex: 201, animation: 'slideUp 0.25s ease-out' }}>
                <div style={{ width: 40, height: 4, background: '#e0e0e0', borderRadius: 2, margin: '0 auto 18px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, background: '#EDE7F6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowRightLeft size={22} color="#4527A0" />
                    </div>
                    <div>
                        <p style={{ fontSize: 16, fontWeight: 800 }}>Konfirmasi Pindah Kursi</p>
                        <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                            Kursi {fromNomor} → Kursi {toSeat.nomor_kursi}
                        </p>
                    </div>
                </div>
                <div style={{ background: '#fafafa', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#555' }}>
                    🔐 Masukkan <strong>No WhatsApp</strong> Anda yang terdaftar saat login untuk konfirmasi
                </div>
                <input
                    className="input-field"
                    type="tel"
                    placeholder="No WhatsApp Anda (mis: 08123456789)"
                    value={inputPhone}
                    onChange={e => setInputPhone(e.target.value)}
                    style={{ marginBottom: error ? 6 : 12 }}
                />
                {error && <p style={{ color: '#C62828', fontSize: 12, marginBottom: 12 }}>⚠️ {error}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onCancel} className="btn-secondary" style={{ flex: 1 }}>Batal</button>
                    <button
                        onClick={() => onConfirm(inputPhone.replace(/\D/g, ''))}
                        disabled={loading || !inputPhone}
                        style={{ flex: 2, background: '#4527A0', color: 'white', border: 'none', borderRadius: 10, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                    >
                        {loading ? 'Memindahkan...' : 'Konfirmasi Pindah'}
                    </button>
                </div>
            </div>
        </>
    );
}

// ===== Wrapper for Suspense =====
export default function SeatsPage() {
    return (
        <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Memuat denah kursi...</div>}>
            <SeatsPageContent />
        </Suspense>
    );
}

function SeatsPageContent() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const busId = params.busId as string;

    // State yang dependen dengan searchParams dialihkan ke useEffect
    const [routeId, setRouteId] = useState('');
    const [tujuan, setTujuan] = useState('');
    const [harga, setHarga] = useState(0);
    const [date, setDate] = useState('');
    const [mode, setMode] = useState('beli');
    const [bookingId, setBookingId] = useState('');
    const [fromNomor, setFromNomor] = useState(0);

    const isPindahMode = mode === 'pindah';

    useEffect(() => {
        setRouteId(searchParams.get('routeId') || '');
        setTujuan(searchParams.get('tujuan') || '');
        setHarga(parseInt(searchParams.get('harga') || '0'));
        setDate(searchParams.get('date') || format(new Date(), 'yyyy-MM-dd'));
        setMode(searchParams.get('mode') || 'beli');
        setBookingId(searchParams.get('bookingId') || '');
        setFromNomor(parseInt(searchParams.get('fromNomor') || '0'));
    }, [searchParams]);

    const [agent, setAgent] = useState<{ name: string; location: string; phone: string } | null>(null);
    const [bus, setBus] = useState<Bus | null>(null);
    const [seats, setSeats] = useState<Seat[]>([]);
    const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
    const [loading, setLoading] = useState(true);
    const [locking, setLocking] = useState(false);
    const [error, setError] = useState('');
    const [lockedBySelf, setLockedBySelf] = useState<string | null>(null);

    // Popup info kursi terisi
    const [popupSeat, setPopupSeat] = useState<Seat | null>(null);
    const [popupBooking, setPopupBooking] = useState<Booking | null>(null);

    // Popup konfirmasi pindah
    const [showConfirmMove, setShowConfirmMove] = useState(false);
    const [moveLoading, setMoveLoading] = useState(false);
    const [moveError, setMoveError] = useState('');

    useEffect(() => {
        const session = getAgentSession();
        if (!session) { router.replace('/'); return; }
        setAgent(session);
    }, [router]);

    const fetchSeats = useCallback(async (silent = false) => {
        if (!busId || !routeId) return;
        if (!silent) setLoading(true);
        try {
            const data = await getSeats(busId, routeId);
            setSeats(data);
        } catch { setError('Gagal memuat kursi'); }
        finally { if (!silent) setLoading(false); }
    }, [busId, routeId]);

    useEffect(() => {
        supabase.from('buses').select('*').eq('id', busId).single().then(({ data }) => {
            if (data) setBus(data as Bus);
        });
    }, [busId]);

    useEffect(() => {
        if (!busId || !routeId) return;
        fetchSeats();
        const channel = supabase.channel(`seats:${busId}:${routeId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'seats', filter: `bus_id=eq.${busId}` },
                () => fetchSeats(true)) // Refresh tanpa muncul 'Memuat...'
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [busId, routeId, fetchSeats]);

    useEffect(() => {
        return () => { if (lockedBySelf) releaseSeat(lockedBySelf).catch(() => { }); };
    }, [lockedBySelf]);

    async function showBookedInfo(seat: Seat) {
        setPopupSeat(seat);
        setPopupBooking(null);
        const { data } = await supabase.from('bookings').select('*').eq('seat_id', seat.id).eq('status', 'confirmed').single();
        setPopupBooking(data as Booking | null);
    }

    async function handleSeatClick(seat: Seat) {
        if (seat.status === 'booked') {
            if (isPindahMode) {
                // Dalam mode pindah, kursi booked tidak bisa dipilih sebagai tujuan
                setError('Pilih kursi yang tersedia (putih)');
                setTimeout(() => setError(''), 2000);
            } else {
                showBookedInfo(seat);
            }
            return;
        }

        if (!agent) return;
        if (seat.status === 'locked' && seat.locked_by_agent !== agent.name) {
            setError('Kursi sedang dipilih oleh agen lain');
            setTimeout(() => setError(''), 2500);
            return;
        }
        setError('');

        if (lockedBySelf && lockedBySelf !== seat.id) {
            await releaseSeat(lockedBySelf);
            setLockedBySelf(null);
        }

        setLocking(true);
        const result = await lockSeat(seat.id, agent.name);
        setLocking(false);

        if (!result.success) {
            setError(result.message);
            setTimeout(() => setError(''), 2500);
            return;
        }
        setLockedBySelf(seat.id);
        setSelectedSeat(seat);
    }

    async function handleConfirmMove(inputPhone: string) {
        if (!selectedSeat || !agent) return;
        setMoveLoading(true);
        setMoveError('');

        const result = await moveBooking(bookingId, selectedSeat.id, inputPhone);
        setMoveLoading(false);

        if (!result.success) {
            setMoveError(result.message);
            return;
        }

        // Sukses - arahkan kembali ke manifest
        setShowConfirmMove(false);
        router.replace(`/armada/${busId}?date=${date}&tab=manifest`);
    }

    function handleContinue() {
        if (!selectedSeat) return;
        if (isPindahMode) {
            // Minta konfirmasi no WA sebelum pindah
            setShowConfirmMove(true);
            return;
        }
        router.push(
            `/armada/${busId}/booking?seatId=${selectedSeat.id}&routeId=${routeId}&tujuan=${encodeURIComponent(tujuan)}&harga=${harga}&nomor=${selectedSeat.nomor_kursi}&date=${date}`
        );
    }

    const displayDate = date ? format(new Date(date + 'T00:00:00'), "EEEE, d MMMM yyyy", { locale: idLocale }) : '';

    function getSeatStyle(seat: Seat) {
        const isSelected = selectedSeat?.id === seat.id;
        if (seat.status === 'booked') return { fill: '#C0392B', stroke: '#C0392B' };
        if (seat.status === 'locked') {
            if (seat.locked_by_agent === agent?.name) return { fill: '#8B1A1A', stroke: '#8B1A1A' };
            return { fill: '#E67E22', stroke: '#E67E22' };
        }
        if (isSelected) return { fill: isPindahMode ? '#4527A0' : '#8B1A1A', stroke: isPindahMode ? '#4527A0' : '#8B1A1A' };
        return { fill: '#EFEFEF', stroke: '#CCCCCC' };
    }

    function getNumberColor(seat: Seat) {
        if (seat.status === 'booked' || seat.status === 'locked' || selectedSeat?.id === seat.id) return 'white';
        return '#333';
    }

    function renderSingleSeat(seat: Seat) {
        const isFromSeat = isPindahMode && seat.nomor_kursi === fromNomor;
        const sStyle = isFromSeat ? { fill: '#E67E22', stroke: '#E67E22' } : getSeatStyle(seat);
        const numColor = (isFromSeat || getSeatStyle(seat).fill !== '#EFEFEF') ? 'white' : '#333';

        return (
            <div
                key={seat.id}
                className="seat-item"
                onClick={() => !locking && !isFromSeat && handleSeatClick(seat)}
                style={{ opacity: isFromSeat ? 0.7 : locking && selectedSeat?.id !== seat.id ? 0.7 : 1, cursor: isFromSeat ? 'not-allowed' : 'pointer' }}
            >
                <svg width="50" height="50" viewBox="0 0 56 56">
                    <rect x="8" y="6" width="40" height="26" rx="6" fill={sStyle.fill} stroke={sStyle.stroke} strokeWidth="1.5" />
                    <rect x="6" y="32" width="44" height="14" rx="5" fill={sStyle.fill} stroke={sStyle.stroke} strokeWidth="1.5" />
                    <rect x="2" y="30" width="6" height="16" rx="3" fill={sStyle.stroke} />
                    <rect x="48" y="30" width="6" height="16" rx="3" fill={sStyle.stroke} />
                    <rect x="14" y="2" width="12" height="10" rx="4" fill={sStyle.fill} stroke={sStyle.stroke} strokeWidth="1.5" />
                    <rect x="30" y="2" width="12" height="10" rx="4" fill={sStyle.fill} stroke={sStyle.stroke} strokeWidth="1.5" />
                    <text x="28" y="23" textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="800" fill={numColor} fontFamily="Inter, sans-serif">
                        {seat.nomor_kursi}
                    </text>
                </svg>
                <span style={{ fontSize: 9, color: seat.status === 'booked' ? '#C0392B' : '#888', marginTop: 1, fontWeight: 600 }}>
                    {isFromSeat ? 'asal' : getSeatLabel(seat)}
                </span>
            </div>
        );
    }

    function renderSeatByNum(num: number | string) {
        const seat = seats.find(s => s.nomor_kursi.toString() === num.toString());
        if (!seat) return <div style={{ width: 50, height: 50, background: '#f9f9f9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#ccc' }}>{num}.</div>;
        return renderSingleSeat(seat);
    }

    function getSeatLabel(seat: Seat) {
        if (seat.status === 'booked') return '🔒';
        if (seat.status === 'locked' && seat.locked_by_agent !== agent?.name) return 'proses';
        return formatCurrency(harga).replace('Rp\u00a0', '').replace('.000', 'k');
    }

    return (
        <div style={{ background: 'var(--gray-bg)', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ background: isPindahMode ? '#4527A0' : 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50 }}>
                <button onClick={() => { if (lockedBySelf) releaseSeat(lockedBySelf).catch(() => { }); router.back(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={20} color={isPindahMode ? 'white' : '#333'} />
                </button>
                <div>
                    {isPindahMode && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>MODE PINDAH KURSI</p>}
                    <p style={{ fontSize: 13, color: isPindahMode ? 'white' : '#888' }}>
                        {isPindahMode ? `Dari Kursi No. ${fromNomor} → pilih kursi baru` : displayDate}
                    </p>
                </div>
            </div>

            {/* Bus Info */}
            {bus && (
                <div style={{ background: 'white', padding: '12px 16px', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
                    <p style={{ fontSize: 12, color: '#888' }}>{bus.arah} / {bus.kode}</p>
                    <p style={{ fontSize: 15, fontWeight: 700 }}>{bus.nama}</p>
                </div>
            )}

            {/* Route info */}
            <div style={{ background: 'white', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', marginBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, color: '#555' }}>{tujuan}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(harga)}</span>
            </div>

            {/* Deck label */}
            <div style={{ margin: '0 16px 8px' }}>
                <span style={{ background: isPindahMode ? '#4527A0' : '#8B1A1A', color: 'white', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                    {isPindahMode ? `PILIH KURSI BARU (dari No. ${fromNomor})` : 'D-BAWAH'}
                </span>
            </div>

            {/* Hint */}
            {!isPindahMode && (
                <div style={{ margin: '0 16px 8px', background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#795548' }}>
                    💡 Klik kursi <strong>merah</strong> untuk lihat info agen & tujuan
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ margin: '0 16px 8px', background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} color="#E67E22" />
                    <span style={{ fontSize: 13, color: '#E67E22' }}>{error}</span>
                </div>
            )}

            {/* Seat Map */}
            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }} className="animate-pulse">Memuat kursi...</div>
            ) : (
                <div className="seat-grid-container" style={{ padding: '4px', maxWidth: 400, margin: '0 auto' }}>
                    {/* Baris Supir / TL / Co-Driver Sejejer */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 56px) 1fr repeat(2, 56px)', gap: 4, marginBottom: 8 }}>
                        <div style={{ background: '#45B3E7', color: 'white', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, height: 44 }}>
                            CO DRIVER
                        </div>
                        {(() => {
                            const tlSeat = seats.find(s => s.nomor_kursi.toString() === 'TL' || s.nomor_kursi === 0);
                            if (!tlSeat) return <div style={{ background: '#45B3E7', color: 'white', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, height: 44 }}>TL</div>;
                            return renderSingleSeat(tlSeat);
                        })()}
                        <div /> {/* Aisle */}
                        <div style={{ gridColumn: 'span 2', background: '#45B3E7', color: 'white', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, height: 44 }}>
                            DRIVER
                        </div>
                    </div>

                    {/* Baris-Baris Utama */}
                    {(() => {
                        const rows = [
                            [1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16],
                            [17, 18, 19, 20], [21, 22, 23, 24], [25, 26, 27, 28], [29, 30, 31, 32],
                            [33, 34, 35, 36], [37, 38, 39, 40]
                        ];
                        return rows.map(r => (
                            <div key={r[0]} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 56px) 1fr repeat(2, 56px)', gap: 4, marginBottom: 4 }}>
                                {r.slice(0, 2).map(n => renderSeatByNum(n))}
                                <div /> {/* Aisle */}
                                {r.slice(2, 4).map(n => renderSeatByNum(n))}
                            </div>
                        ));
                    })()}

                    {/* Baris 51 52 (Pintu) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 56px) 1fr repeat(2, 56px)', gap: 4, marginBottom: 4 }}>
                        {renderSeatByNum(51)}
                        {renderSeatByNum(52)}
                        <div /> {/* Aisle */}
                        <div style={{ gridColumn: 'span 2', background: '#f5f5f5', border: '1px solid #eee', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#aaa' }}>PINTU</div>
                    </div>

                    {/* Baris 41 42 | 43 44 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 56px) 1fr repeat(2, 56px)', gap: 4, marginBottom: 4 }}>
                        {renderSeatByNum(41)}
                        {renderSeatByNum(42)}
                        <div /> {/* Aisle */}
                        {renderSeatByNum(43)}
                        {renderSeatByNum(44)}
                    </div>

                    {/* Baris Paling Belakang (FULL 6 Kursi) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginTop: 4 }}>
                        {[45, 46, 47, 48, 49, 50].map(n => (
                            <div key={n} style={{ textAlign: 'center' }}>
                                {renderSeatByNum(n)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'white', margin: '8px 0', justifyContent: 'center', flexWrap: 'wrap' }}>
                {(isPindahMode ? [
                    { color: '#EFEFEF', label: 'Tersedia' },
                    { color: '#4527A0', label: 'Dipilih' },
                    { color: '#E67E22', label: 'Kursi Asal' },
                    { color: '#C0392B', label: 'Terisi' },
                ] : [
                    { color: '#EFEFEF', label: 'Tersedia' },
                    { color: '#8B1A1A', label: 'Dipilih' },
                    { color: '#C0392B', label: 'Terisi' },
                    { color: '#E67E22', label: 'Diproses' },
                ]).map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 14, height: 14, background: l.color, borderRadius: 3, border: '1px solid #ccc' }} />
                        <span style={{ fontSize: 11, color: '#666' }}>{l.label}</span>
                    </div>
                ))}
            </div>

            <div style={{ height: 90 }} />

            {/* Bottom CTA */}
            <div className="bottom-bar">
                {selectedSeat ? (
                    <>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 12, color: '#888' }}>{isPindahMode ? 'Pindah ke kursi' : 'Kursi dipilih'}</p>
                            <p style={{ fontSize: 16, fontWeight: 700, color: isPindahMode ? '#4527A0' : '#8B1A1A' }}>No. {selectedSeat.nomor_kursi}</p>
                        </div>
                        <button
                            style={{ background: isPindahMode ? '#4527A0' : 'var(--maroon)', color: 'white', border: 'none', borderRadius: 10, padding: '14px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                            onClick={handleContinue}
                        >
                            {isPindahMode ? 'PINDAH KURSI' : 'LANJUTKAN PEMBELIAN'}
                        </button>
                    </>
                ) : (
                    <button className="btn-primary" disabled>
                        {isPindahMode ? 'PILIH KURSI TUJUAN' : 'PILIH KURSI TERLEBIH DAHULU'}
                    </button>
                )}
            </div>

            {/* Popup info kursi terisi (mode beli only) */}
            {popupSeat && (
                <SeatInfoPopup seat={popupSeat} booking={popupBooking} onClose={() => { setPopupSeat(null); setPopupBooking(null); }} />
            )}

            {/* Popup konfirmasi pindah kursi (mode pindah) */}
            {showConfirmMove && selectedSeat && (
                <ConfirmMovePopup
                    fromNomor={fromNomor}
                    toSeat={selectedSeat}
                    agentPhone={agent?.phone || ''}
                    onConfirm={handleConfirmMove}
                    onCancel={() => { setShowConfirmMove(false); setMoveError(''); }}
                    loading={moveLoading}
                    error={moveError}
                />
            )}
        </div>
    );
}
