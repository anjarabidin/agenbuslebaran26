'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, MessageCircle, ArrowLeft, Share2 } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';

export default function BookingSuccessPage() {
    return (
        <Suspense fallback={<div style={{ padding: 20, textAlign: 'center' }}>Memuat tiket...</div>}>
            <SuccessPageContent />
        </Suspense>
    );
}

function SuccessPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const bookingId = searchParams.get('bookingId') || '';
    // nomor & passenger can be comma-separated for multi-seat
    const nomorRaw = searchParams.get('nomor') || '';
    const passengerRaw = searchParams.get('passenger') || '';
    const nomors = nomorRaw.split(',').filter(Boolean);
    const passengers = passengerRaw.split(';').filter(Boolean);

    const tujuan = searchParams.get('tujuan') || '';
    const phone = searchParams.get('phone') || '';
    const harga = parseInt(searchParams.get('harga') || '0');
    const count = parseInt(searchParams.get('count') || '1');
    const busKode = searchParams.get('busKode') || '';
    const busArah = searchParams.get('busArah') || '';
    const busNama = searchParams.get('busNama') || '';
    const jamBerangkat = searchParams.get('jamBerangkat') || '';
    const agentName = searchParams.get('agentName') || '';
    const agentLocation = searchParams.get('agentLocation') || '';

    const isMulti = nomors.length > 1;
    // Harga per kursi
    const hargaPerSeat = isMulti ? Math.round(harga / count) : harga;

    function handleSendWA() {
        const cleaned = phone.replace(/\D/g, '').replace(/^0/, '62');
        const tgl = format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale });
        const hargaFormatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(harga);

        let message = `🎫 *TIKET BUS*\n━━━━━━━━━━━━━━━━━━\n`;
        message += `🚌 *Bus:* ${busKode} (${busArah})\n`;
        message += `📍 *Rute:* ${agentLocation} → ${tujuan}\n`;
        message += `📅 *Tgl Berangkat:* ${tgl}\n`;

        if (isMulti) {
            message += `💺 *Total Kursi:* ${nomors.length}\n`;
            nomors.forEach((n, i) => {
                message += `  - Kursi ${n}: ${passengers[i] || '-'}\n`;
            });
        } else {
            message += `💺 *Kursi:* No. ${nomors[0]}\n`;
            message += `👤 *Penumpang:* ${passengers[0]}\n`;
        }

        message += `💰 *Total:* ${hargaFormatted}\n`;
        message += `━━━━━━━━━━━━━━━━━━\n🏪 *Agen:* ${agentName}\nTerima kasih! 🙏`;

        window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`, '_blank');
    }

    const [sharing, setSharing] = useState(false);

    async function handleShareImage() {
        const ticket = document.getElementById('print-area');
        if (!ticket) return;

        setSharing(true);
        try {
            const blob = await toBlob(ticket, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                skipFonts: false,
            });

            if (blob && navigator.share) {
                const filename = isMulti
                    ? `tiket_${nomors.join('-')}.png`
                    : `tiket_${nomors[0]}_${passengers[0]}.png`;
                const file = new File([blob], filename, { type: 'image/png' });
                await navigator.share({
                    files: [file],
                    title: 'Tiket Bus',
                    text: `Tiket Bus untuk ${passengers.join(', ')}`,
                });
            } else if (blob) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `tiket_${nomors.join('-')}.png`;
                a.click();
            }
        } catch (err) {
            console.error('Error sharing ticket:', err);
            alert('Gagal membagikan tiket. Coba lagi.');
        } finally {
            setSharing(false);
        }
    }

    if (!mounted) return null;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--gray-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 24px 120px' }}>

            {/* Success icon */}
            <div className="no-print" style={{ marginBottom: 24, textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, background: '#E8F5E9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <CheckCircle2 size={48} color="#27AE60" />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A' }}>
                    {isMulti ? `${nomors.length} Tiket Berhasil Dipesan!` : 'Tiket Berhasil Dipesan!'}
                </h2>
                <p style={{ fontSize: 14, color: '#888', marginTop: 6 }}>Booking telah dikonfirmasi</p>
            </div>

            {/* Ticket card(s) */}
            <div id="print-area" style={{ background: 'white', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.1)', marginBottom: 24, border: '1px solid #eee' }}>

                {/* Ticket Header */}
                <div style={{ textAlign: 'center', marginBottom: 20, borderBottom: '2px solid #8B1A1A', paddingBottom: 14 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#8B1A1A', margin: 0 }}>E-TICKET BUS</h3>
                    <p style={{ fontSize: 10, color: '#888', margin: '4px 0 0' }}>
                        {isMulti ? `${nomors.length} Kursi` : `ID: ${bookingId}`}
                    </p>
                </div>

                {/* Bus info */}
                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px dashed #e0e0e0' }}>
                    <p style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{busArah} / {busKode}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{busNama.replace(/^[^-]+/, agentLocation)}</p>
                    <p style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{agentLocation} → {tujuan}</p>
                </div>

                {/* Passengers list (multi) or single */}
                {isMulti ? (
                    <div style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 10, color: '#888', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>Daftar Penumpang</p>
                        {nomors.map((n, i) => (
                            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < nomors.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 26, height: 26, background: '#8B1A1A', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 800 }}>{n}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{passengers[i] || '-'}</span>
                                </div>
                                <span style={{ fontSize: 12, color: '#555' }}>{formatCurrency(hargaPerSeat)}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #e0e0e0', fontWeight: 700 }}>
                            <span style={{ fontSize: 13 }}>Total</span>
                            <span style={{ fontSize: 15, color: '#8B1A1A' }}>{formatCurrency(harga)}</span>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <div>
                            <p style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>No Kursi</p>
                            <p style={{ fontSize: 24, fontWeight: 800, color: '#8B1A1A' }}>{nomors[0]}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>Harga</p>
                            <p style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(harga)}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>Penumpang</p>
                            <p style={{ fontSize: 14, fontWeight: 600 }}>{passengers[0]}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>No HP</p>
                            <p style={{ fontSize: 14, fontWeight: 600 }}>{phone}</p>
                        </div>
                    </div>
                )}

                {/* QR Code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', borderTop: '1px dashed #e0e0e0', borderBottom: '1px dashed #e0e0e0', marginBottom: 20 }}>
                    <QRCodeSVG value={bookingId || 'NO_ID'} size={160} level="H" includeMargin />
                    <p style={{ fontSize: 10, color: '#AAA', marginTop: 10 }}>Scan QR untuk validasi tiket</p>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, margin: 0 }}>AGEN: {agentName}</p>
                    <p style={{ fontSize: 10, color: '#888' }}>{agentLocation}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="no-print" style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                    style={{ background: '#4527A0', color: 'white', border: 'none', borderRadius: 12, padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(69,39,160,0.3)' }}
                    onClick={handleShareImage}
                    disabled={sharing}
                >
                    <Share2 size={20} />
                    {sharing ? 'Menyiapkan...' : 'Cetak Tiket / Bagikan Gambar'}
                </button>

                <button
                    style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: 12, padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    onClick={handleSendWA}
                >
                    <MessageCircle size={20} />
                    Kirim via WhatsApp (Teks)
                </button>

                <button
                    className="btn-secondary"
                    onClick={() => router.push('/armada')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                    <ArrowLeft size={16} />
                    Kembali ke Armada
                </button>
            </div>
        </div>
    );
}
