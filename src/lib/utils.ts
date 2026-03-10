import type { Booking, Bus, Route } from '@/types';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
}

export function formatTicketMessage(
    booking: Booking & { buses?: Bus; routes?: Route }
): string {
    const tgl = format(new Date(booking.created_at), "EEEE, d MMMM yyyy", { locale: idLocale });
    const via = booking.routes?.via_stops?.join(' - ') || '';
    const hargaFormatted = formatCurrency(booking.harga);

    return (
        `🎫 *TIKET BUS - OPERASIONAL*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🚌 *Bus:* ${booking.buses?.kode || ''} (${booking.buses?.arah || ''})\n` +
        `📍 *Rute:* ${booking.routes?.kota_asal || ''} → ${booking.routes?.kota_tujuan || ''}\n` +
        (via ? `🛣️  *Via:* ${via}\n` : '') +
        `📅 *Tgl:* ${tgl} | ${booking.buses?.jam_berangkat || ''}\n` +
        `💺 *Kursi:* No. ${booking.nomor_kursi}\n` +
        `👤 *Penumpang:* ${booking.passenger_name}\n` +
        `📞 *No HP:* ${booking.passenger_phone}\n` +
        `📌 *Tujuan:* ${booking.tujuan}\n` +
        `💰 *Harga:* ${hargaFormatted}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🏪 *Agen:* ${booking.agent_name}\n` +
        `📍 *Lokasi:* ${booking.agent_location}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Terima kasih telah memesan! 🙏\n` +
        `_Mohon simpan tiket ini sebagai bukti pemesanan._`
    );
}

export function openWhatsApp(phone: string, booking: Booking & { buses?: Bus; routes?: Route }) {
    const cleaned = phone.replace(/\D/g, '').replace(/^0/, '62');
    const message = formatTicketMessage(booking);
    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

export function getAgentSession(): { name: string; location: string; phone: string } | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem('agent_session');
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

export function setAgentSession(name: string, location: string, phone: string) {
    localStorage.setItem('agent_session', JSON.stringify({ name, location, phone }));
}

export function clearAgentSession() {
    localStorage.removeItem('agent_session');
}
