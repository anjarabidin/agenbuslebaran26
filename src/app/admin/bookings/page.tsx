'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, XCircle, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { formatCurrency, openWhatsApp } from '@/lib/utils';
import { getSeats, moveBooking } from '@/lib/db';
import type { Booking, Bus, Route, Seat } from '@/types';

type BookingWithDetails = Booking & { buses: Bus; routes: Route };

import Papa from 'papaparse';

export default function AdminBookingsPage() {
    const router = useRouter();
    const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
    const [buses, setBuses] = useState<Bus[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState('');
    const [filterBus, setFilterBus] = useState('');
    const [filterAgent, setFilterAgent] = useState('');
    const [filterStatus, setFilterStatus] = useState('confirmed');
    const [cancelling, setCancelling] = useState<string | null>(null);

    // Move seat state
    const [movingBooking, setMovingBooking] = useState<BookingWithDetails | null>(null);
    const [availableSeats, setAvailableSeats] = useState<Seat[]>([]);
    const [loadingSeats, setLoadingSeats] = useState(false);
    const [moveError, setMoveError] = useState('');

    useEffect(() => {
        setFilterDate(format(new Date(), 'yyyy-MM-dd'));
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('admin_auth') !== 'true') {
            router.replace('/admin');
        }
    }, [router]);

    useEffect(() => {
        if (!filterDate) return;
        supabase.from('buses')
            .select('*')
            .eq('tanggal', filterDate)
            .then(({ data }) => setBuses((data as Bus[]) || []));
    }, [filterDate]);

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        // Gunakan !inner agar filter tanggal bis memfilter baris bookingnya juga
        let query = supabase
            .from('bookings')
            .select('*, buses!inner(kode, nama, arah, jam_berangkat, tanggal), routes(kota_asal, kota_tujuan, via_stops)')
            .order('nomor_kursi', { ascending: true });

        if (filterDate) {
            query = query.eq('buses.tanggal', filterDate);
        }
        if (filterBus) query = query.eq('bus_id', filterBus);
        if (filterAgent.trim()) query = query.ilike('agent_name', `%${filterAgent}%`);
        if (filterStatus) query = query.eq('status', filterStatus);

        const { data, error } = await query;
        if (!error) setBookings((data as BookingWithDetails[]) || []);
        setLoading(false);
    }, [filterDate, filterBus, filterAgent, filterStatus]);

    useEffect(() => { fetchBookings(); }, [fetchBookings]);

    async function handleCancel(bookingId: string) {
        if (!confirm('Batalkan booking ini? Kursi akan dikembalikan ke tersedia.')) return;
        setCancelling(bookingId);
        await supabase.rpc('cancel_booking', { p_booking_id: bookingId });
        await fetchBookings();
        setCancelling(null);
    }

    async function handleOpenMove(b: BookingWithDetails) {
        setMovingBooking(b);
        setLoadingSeats(true);
        setMoveError('');
        try {
            const allSeats = await getSeats(b.bus_id, b.route_id);
            setAvailableSeats(allSeats.filter(s => s.status === 'available'));
        } catch (e) {
            setMoveError('Gagal memuat daftar kursi');
        } finally {
            setLoadingSeats(false);
        }
    }

    async function handleConfirmMove(newSeatId: string) {
        if (!movingBooking) return;
        setLoadingSeats(true);
        try {
            const res = await moveBooking(movingBooking.id, newSeatId, movingBooking.agent_phone);
            if (res.success) {
                alert(res.message);
                setMovingBooking(null);
                await fetchBookings();
            } else {
                setMoveError(res.message);
            }
        } catch (e) {
            setMoveError('Terjadi kesalahan sistem');
        } finally {
            setLoadingSeats(false);
        }
    }

    const totalRevenue = bookings.filter(b => b.status === 'confirmed').reduce((s, b) => s + b.harga, 0);

    function handleDownloadCSV() {
        if (bookings.length === 0) return alert('Tidak ada data untuk didownload');

        const dataToExport = bookings.map(b => ({
            'Tanggal': format(new Date(b.created_at), 'yyyy-MM-dd HH:mm'),
            'Bus': b.buses?.kode || '-',
            'Arah': b.buses?.arah || '-',
            'Kursi': b.nomor_kursi,
            'Nama Penumpang': b.passenger_name,
            'No HP': b.passenger_phone,
            'Tujuan': b.tujuan,
            'Harga': b.harga,
            'Agen': b.agent_name,
            'Lokasi Agen': b.agent_location,
            'Status': b.status
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `laporan_booking_${filterDate || 'semua'}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Updated Header with Download Button
    return (
        <div style={{ background: 'var(--gray-bg)', minHeight: '100vh' }}>
            {/* Header */}
            <div className="header-maroon">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={() => router.push('/admin/dashboard')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <p style={{ fontSize: 11, opacity: 0.7 }}>Admin</p>
                            <h1 style={{ fontSize: 20, fontWeight: 800 }}>Laporan Booking</h1>
                        </div>
                    </div>
                    <button
                        onClick={handleDownloadCSV}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '8px 12px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
                    >
                        <Download size={16} /> Download
                    </button>
                </div>
            </div>

            {/* Revenue Summary */}
            <div style={{ background: 'white', padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <p style={{ fontSize: 11, color: '#888' }}>Total booking ditemukan</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: '#8B1A1A' }}>{bookings.length} tiket</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: '#888' }}>Total revenue</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#2E7D32' }}>{formatCurrency(totalRevenue)}</p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ background: 'white', padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" className="input-field" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ flex: 1, padding: '10px 12px', fontSize: 13 }} />
                    <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}>
                        <option value="">Semua Status</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <select className="input-field" value={filterBus} onChange={e => setFilterBus(e.target.value)} style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}>
                        <option value="">Semua Bus</option>
                        {buses.map(b => <option key={b.id} value={b.id}>{b.kode}</option>)}
                    </select>
                    <input className="input-field" type="text" placeholder="Cari nama agen..." value={filterAgent} onChange={e => setFilterAgent(e.target.value)} style={{ flex: 1, padding: '10px 12px', fontSize: 13 }} />
                </div>
            </div>

            {/* Booking List */}
            <div style={{ paddingBottom: 24 }}>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }} className="animate-pulse">Memuat data...</div>
                ) : bookings.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Tidak ada booking ditemukan</div>
                ) : (
                    bookings.map(b => (
                        <div key={b.id} style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <div>
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                        <span style={{ display: 'inline-block', width: 26, height: 26, background: 'var(--maroon)', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: '26px' }}>{b.nomor_kursi}</span>
                                        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{b.passenger_name}</span>
                                    </div>
                                    <p style={{ fontSize: 12, color: '#666' }}>📞 {b.passenger_phone}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span className={`badge ${b.status === 'confirmed' ? 'badge-green' : 'badge-orange'}`}>{b.status}</span>
                                    <p style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{formatCurrency(b.harga)}</p>
                                </div>
                            </div>

                            <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 12, color: '#555' }}>
                                <p>🚌 {b.buses?.kode} • {b.buses?.arah} | 🎯 {b.tujuan}</p>
                                <p style={{ marginTop: 2 }}>🏪 Agen: <strong>{b.agent_name}</strong> ({b.agent_location})</p>
                                {b.catatan && <p style={{ marginTop: 2 }}>📝 {b.catatan}</p>}
                                <p style={{ marginTop: 2, color: '#aaa' }}>🕐 {format(new Date(b.created_at), "d MMM yyyy HH:mm", { locale: idLocale })}</p>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={() => openWhatsApp(b.passenger_phone, { ...b, buses: b.buses, routes: b.routes })}
                                    style={{ flex: 1, background: '#25D366', color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                >
                                    <MessageCircle size={15} /> Kirim WA
                                </button>
                                {b.status === 'confirmed' && (
                                    <button
                                        onClick={() => handleCancel(b.id)}
                                        disabled={cancelling === b.id}
                                        style={{ background: '#ffebee', color: '#C62828', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                        <XCircle size={15} /> {cancelling === b.id ? '...' : 'Batal'}
                                    </button>
                                )}
                                {b.status === 'confirmed' && (
                                    <button
                                        onClick={() => handleOpenMove(b)}
                                        style={{ background: '#f0f4ff', color: '#1565C0', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                        Pindah Kursi
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
            {/* Modal Pindah Kursi */}
            {movingBooking && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 400, padding: 20, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Pindahkan Kursi: {movingBooking.passenger_name}</h3>
                            <button onClick={() => setMovingBooking(null)} style={{ background: 'none', border: 'none' }}><XCircle size={20} color="#888" /></button>
                        </div>
                        <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Kursi saat ini: <strong>No. {movingBooking.nomor_kursi}</strong>. Pilih kursi baru:</p>

                        {moveError && <div style={{ background: '#ffebee', color: '#C62828', padding: '10px', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>{moveError}</div>}

                        <div style={{ overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, paddingBottom: 10 }}>
                            {loadingSeats ? (
                                <div style={{ gridColumn: 'span 5', textAlign: 'center', padding: 20, color: '#aaa' }}>Memuat...</div>
                            ) : availableSeats.length === 0 ? (
                                <div style={{ gridColumn: 'span 5', textAlign: 'center', padding: 20, color: '#aaa' }}>Penuh</div>
                            ) : (
                                availableSeats.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleConfirmMove(s.id)}
                                        style={{ background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: '10px 4px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        {s.nomor_kursi}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
