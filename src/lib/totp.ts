import crypto from 'crypto';

// RFC 6238 TOTP using Node's built-in crypto — no external dependency needed.

function base32Decode(base32: string): Buffer {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = base32.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const output: number[] = [];
    for (const char of clean) {
        const idx = chars.indexOf(char);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(output);
}

function base32Encode(buffer: Buffer): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            result += chars[(value >>> (bits - 5)) & 0x1f];
            bits -= 5;
        }
    }
    if (bits > 0) result += chars[(value << (5 - bits)) & 0x1f];
    while (result.length % 8 !== 0) result += '=';
    return result;
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac[offset] & 0x7f) << 24)
        | ((hmac[offset + 1] & 0xff) << 16)
        | ((hmac[offset + 2] & 0xff) << 8)
        | (hmac[offset + 3] & 0xff);
    return String(code % Math.pow(10, digits)).padStart(digits, '0');
}

export const totp = {
    generateSecret(): string {
        return base32Encode(crypto.randomBytes(20));
    },

    generate(secret: string): string {
        const counter = Math.floor(Date.now() / 1000 / 30);
        return hotp(base32Decode(secret), counter);
    },

    verify({ token, secret }: { token: string; secret: string }): boolean {
        const counter = Math.floor(Date.now() / 1000 / 30);
        // Allow ±1 time step for clock drift
        for (let delta = -1; delta <= 1; delta++) {
            if (hotp(base32Decode(secret), counter + delta) === token) return true;
        }
        return false;
    },

    keyuri(account: string, issuer: string, secret: string): string {
        const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
        return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params}`;
    }
};
