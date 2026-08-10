const express = require('express');
const zlib = require('zlib');

const app = express();

app.use(express.text({ type: '*/*', limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

function bigIntToBytes(bigIntString) {
    const cleanNumericString = String(bigIntString).replace(/\D/g, '');
    if (!cleanNumericString) {
        throw new Error("QR Data me koi valid numeric digits nahi mile.");
    }
    let bigInt = BigInt(cleanNumericString);
    let hex = bigInt.toString(16);
    if (hex.length % 2 !== 0) {
        hex = '0' + hex;
    }
    return Buffer.from(hex, 'hex');
}

app.post('/api/decode-aadhaar', (req, res) => {
    try {
        let rawInput = req.body;

        if (typeof rawInput === 'string' && rawInput.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(rawInput);
                rawInput = parsed.qrData || rawInput;
            } catch (e) {}
        }

        const cleanDigits = String(rawInput).replace(/\D/g, '');
        console.log("--> Received Clean Data Length:", cleanDigits.length);

        // 1. BigInt to Bytes
        const compressedBuffer = bigIntToBytes(cleanDigits);

        // 2. Decompress
        let decompressedBuffer = null;
        try {
            decompressedBuffer = zlib.inflateRawSync(compressedBuffer);
        } catch (e1) {
            try {
                decompressedBuffer = zlib.inflateSync(compressedBuffer);
            } catch (e2) {
                decompressedBuffer = zlib.gunzipSync(compressedBuffer);
            }
        }

        // 3. Byte 255 (0xFF) Split
        const parts = [];
        let currentPart = [];
        for (let i = 0; i < decompressedBuffer.length; i++) {
            if (decompressedBuffer[i] === 255) {
                parts.push(Buffer.from(currentPart));
                currentPart = [];
            } else {
                currentPart.push(decompressedBuffer[i]);
            }
        }
        if (currentPart.length > 0) parts.push(Buffer.from(currentPart));

        // 4. Photo aur Text Parts ko alag Karein
        let photoBase64 = null;
        let textParts = [];

        parts.forEach((part) => {
            // JPEG Header (0xFF 0xD8 -> 255, 216) ya Large Buffer check karein
            if (part.length > 500 || (part.length > 2 && part[0] === 255 && part[1] === 216)) {
                photoBase64 = `data:image/jpeg;base64,${part.toString('base64')}`;
            } else {
                textParts.push(part.toString('utf8').trim());
            }
        });

        console.log("--> Extracted Text Parts:", textParts);

        // Aadhaar V2 Secure QR Structure
        return res.status(200).json({
            success: true,
            data: {
                referenceId: textParts[1] || textParts[0] || '',
                name: textParts[2] || '',
                dob: textParts[3] || '',
                gender: textParts[4] || '',
                address: {
                    house: textParts[5] || '',
                    street: textParts[6] || '',
                    vtc: textParts[7] || textParts[8] || '',
                    district: textParts[9] || textParts[8] || '',
                    state: textParts[10] || '',
                    pincode: textParts[11] || textParts[12] || ''
                },
                photoBase64: photoBase64
            }
        });

    } catch (error) {
        console.error("General Error:", error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Processing Error", 
            error: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
