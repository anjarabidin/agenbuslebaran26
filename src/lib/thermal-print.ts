/**
 * Thermal Bluetooth Printer Utility
 * Supports ESC/POS via Web Bluetooth BLE
 * Compatible with common BLE thermal printers (Xprinter, RPP, generic BLE UART)
 */

// Common BLE Printer Service UUIDs
const PRINTER_SERVICE_UUIDS = [
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Xprinter BLE
    '000018f0-0000-1000-8000-00805f9b34fb', // Generic BLE Serial Port
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip BM77 UART
    '0000ff00-0000-1000-8000-00805f9b34fb', // Common RPP / generic
    '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10/HM-11 BLE UART
    '0000fff0-0000-1000-8000-00805f9b34fb', // Common short UUID FFF0
];

// ESC/POS Commands
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

function cmd(...bytes: number[]): Uint8Array {
    return new Uint8Array(bytes);
}

export const ESC_POS = {
    INIT:           cmd(ESC, 0x40),                     // Initialize printer
    ALIGN_LEFT:     cmd(ESC, 0x61, 0x00),               // Left align
    ALIGN_CENTER:   cmd(ESC, 0x61, 0x01),               // Center align
    ALIGN_RIGHT:    cmd(ESC, 0x61, 0x02),               // Right align
    BOLD_ON:        cmd(ESC, 0x45, 0x01),               // Bold on
    BOLD_OFF:       cmd(ESC, 0x45, 0x00),               // Bold off
    SIZE_NORMAL:    cmd(GS,  0x21, 0x00),               // Normal size
    SIZE_DOUBLE_H:  cmd(GS,  0x21, 0x10),               // Double height
    SIZE_DOUBLE_WH: cmd(GS,  0x21, 0x11),               // Double width & height
    UNDERLINE_ON:   cmd(ESC, 0x2D, 0x01),               // Underline on
    UNDERLINE_OFF:  cmd(ESC, 0x2D, 0x00),               // Underline off
    LF:             cmd(LF),                             // Line feed
    FEED_3:         cmd(ESC, 0x64, 0x03),               // Feed 3 lines
    CUT:            cmd(GS,  0x56, 0x41, 0x05),         // Partial cut
    CHARSET_PC437:  cmd(ESC, 0x74, 0x00),               // PC437 (Western)
};

export type PaperWidth = 58 | 80;

// Char widths per paper size (at normal char width)
export function getCharsPerLine(paperWidth: PaperWidth): number {
    return paperWidth === 58 ? 32 : 48;
}

/** Pad string to fill line */
function padLine(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
    if (text.length >= width) return text.slice(0, width);
    const pad = width - text.length;
    if (align === 'right') return ' '.repeat(pad) + text;
    if (align === 'center') {
        const half = Math.floor(pad / 2);
        return ' '.repeat(half) + text + ' '.repeat(pad - half);
    }
    return text + ' '.repeat(pad);
}

/** Two-column row (left + right) */
function twoCol(left: string, right: string, width: number): string {
    const maxLeft = width - right.length - 1;
    const l = left.length > maxLeft ? left.slice(0, maxLeft) : left;
    const pad = width - l.length - right.length;
    return l + ' '.repeat(Math.max(1, pad)) + right;
}

/** Divider line */
function divider(width: number, char = '-'): string {
    return char.repeat(width);
}

/** Encode text to Uint8Array (UTF-8 with fallback for ID chars) */
function encodeText(text: string): Uint8Array {
    // Replace common Indonesian chars that may not exist in PC437
    const cleaned = text
        .replace(/\u2192/g, '->') // →
        .replace(/[^\x00-\x7E]/g, '?'); // fallback for unsupported chars
    return new TextEncoder().encode(cleaned + '\n');
}

/** Concatenate multiple Uint8Arrays */
function concat(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((n, a) => n + a.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
        out.set(a, offset);
        offset += a.length;
    }
    return out;
}

// ===== Build Ticket Bytes =====

interface TicketData {
    busKode: string;
    busArah: string;
    agentLocation: string;
    tujuan: string;
    nomors: string[];
    passengers: string[];
    hargaPerSeat: number;
    totalHarga: number;
    agentName: string;
    bookingId: string;
    paperWidth: PaperWidth;
}

export function buildTicketBytes(data: TicketData): Uint8Array {
    const w = getCharsPerLine(data.paperWidth);
    const parts: Uint8Array[] = [];

    function line(text: string): void {
        parts.push(encodeText(text));
    }

    // Init
    parts.push(ESC_POS.INIT);
    parts.push(ESC_POS.CHARSET_PC437);

    // Header
    parts.push(ESC_POS.ALIGN_CENTER);
    parts.push(ESC_POS.SIZE_DOUBLE_H);
    parts.push(ESC_POS.BOLD_ON);
    line('E-TICKET BUS');
    parts.push(ESC_POS.SIZE_NORMAL);
    parts.push(ESC_POS.BOLD_OFF);
    line(divider(w, '='));

    // Bus info
    parts.push(ESC_POS.ALIGN_LEFT);
    parts.push(ESC_POS.BOLD_ON);
    line(`${data.busKode} - ${data.busArah}`);
    parts.push(ESC_POS.BOLD_OFF);
    line(`${data.agentLocation} -> ${data.tujuan}`);
    line(divider(w));

    // Passengers
    if (data.nomors.length === 1) {
        // Single ticket
        line(twoCol('Kursi:', data.nomors[0], w));
        parts.push(ESC_POS.BOLD_ON);
        line(data.passengers[0] || '-');
        parts.push(ESC_POS.BOLD_OFF);
        line(twoCol('Harga:', `Rp${data.hargaPerSeat.toLocaleString('id-ID')}`, w));
    } else {
        // Multi ticket
        line(`Jumlah Kursi: ${data.nomors.length}`);
        line(divider(w));
        data.nomors.forEach((n, i) => {
            const nama = data.passengers[i] || '-';
            const hargaStr = `Rp${data.hargaPerSeat.toLocaleString('id-ID')}`;
            line(twoCol(`[${n}] ${nama}`, hargaStr, w));
        });
        line(divider(w));
        parts.push(ESC_POS.BOLD_ON);
        line(twoCol('TOTAL:', `Rp${data.totalHarga.toLocaleString('id-ID')}`, w));
        parts.push(ESC_POS.BOLD_OFF);
    }

    line(divider(w));

    // QR Code (ESC/POS GS(k) native QR print command)
    // Only print if we have a bookingId
    if (data.bookingId) {
        parts.push(ESC_POS.ALIGN_CENTER);
        parts.push(...buildQRCodeBytes(data.bookingId, data.paperWidth === 80 ? 8 : 6));
        parts.push(ESC_POS.LF);
    }

    line(divider(w));

    // Agent
    parts.push(ESC_POS.ALIGN_CENTER);
    line(`Agen: ${data.agentName}`);
    if (data.bookingId) {
        // Print short ID as text below QR
        const shortId = data.bookingId.slice(0, 16).toUpperCase();
        line(shortId);
    }
    line('Terima kasih!');

    // Feed and Cut
    parts.push(ESC_POS.FEED_3);
    parts.push(ESC_POS.CUT);

    return concat(...parts);
}

/**
 * Build ESC/POS QR Code bytes using GS ( k command sequence.
 * size: module size 1–16 (4=small, 6=medium, 8=large)
 */
function buildQRCodeBytes(data: string, size: number = 6): Uint8Array[] {
    const dataBytes = new TextEncoder().encode(data);
    const dataLen = dataBytes.length + 3; // cn(1) + fn(1) + m(1) + data

    // pL and pH encode dataLen as little-endian 16-bit
    const pL = dataLen & 0xFF;
    const pH = (dataLen >> 8) & 0xFF;

    return [
        // 1. Set QR model 2 (most compatible)
        new Uint8Array([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
        // 2. Set module size (1-16)
        new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size]),
        // 3. Set error correction level M (50 = M)
        new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]),
        // 4. Store QR data: GS ( k pL pH 0x31 0x50 0x30 [data]
        new Uint8Array([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...dataBytes]),
        // 5. Print QR from buffer
        new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]),
    ];
}

// ===== Web Bluetooth Connection =====

let bluetoothDevice: BluetoothDevice | null = null;
let printerCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

export async function connectBluetoothPrinter(): Promise<void> {
    if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth tidak didukung di browser ini. Gunakan Chrome di Android/Desktop.');
    }

    // Disconnect if already connected
    if (bluetoothDevice?.gatt?.connected) {
        await bluetoothDevice.gatt.disconnect();
    }

    const device = await navigator.bluetooth.requestDevice({
        // Filter to known printer services, or accept any device
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICE_UUIDS,
    });

    bluetoothDevice = device;
    const server = await device.gatt!.connect();

    // Try each service UUID until one works
    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

    for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
        try {
            const service = await server.getPrimaryService(serviceUuid);
            const chars = await service.getCharacteristics();
            // Find a writable characteristic
            const writable = chars.find(c =>
                c.properties.write ||
                c.properties.writeWithoutResponse
            );
            if (writable) {
                characteristic = writable;
                break;
            }
        } catch {
            // Service not found, try next
        }
    }

    if (!characteristic) {
        throw new Error('Tidak dapat menemukan karakteristik printer. Pastikan printer dalam mode pairing.');
    }

    printerCharacteristic = characteristic;
}

export function isPrinterConnected(): boolean {
    return !!(bluetoothDevice?.gatt?.connected && printerCharacteristic);
}

export function disconnectPrinter(): void {
    if (bluetoothDevice?.gatt?.connected) {
        bluetoothDevice.gatt.disconnect();
    }
    printerCharacteristic = null;
}

/** Send bytes to printer in chunks (BLE MTU is typically 512 bytes max) */
export async function printBytes(data: Uint8Array): Promise<void> {
    if (!printerCharacteristic) {
        throw new Error('Printer tidak terhubung');
    }

    const CHUNK_SIZE = 512;
    const useWithoutResponse = printerCharacteristic.properties.writeWithoutResponse && !printerCharacteristic.properties.write;

    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const chunk = data.slice(offset, offset + CHUNK_SIZE);
        if (useWithoutResponse) {
            await printerCharacteristic.writeValueWithoutResponse(chunk);
        } else {
            await printerCharacteristic.writeValue(chunk);
        }
        // Small delay between chunks for stability
        await new Promise(r => setTimeout(r, 20));
    }
}
