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
            } catch (e) {
                // Ignore
            }
        }

        const cleanDigits = String(rawInput).replace(/\D/g, '');
        console.log("--> Received Clean Data Length:", cleanDigits.length);

        // 1. Convert BigInt to Bytes
        let compressedBuffer;
        try {
            compressedBuffer = bigIntToBytes(cleanDigits);
        } catch (err) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid Numeric QR Data", 
                error: err.message 
            });
        }

        // 2. Multi-Format Decompression (Fallback mechanism)
        let decompressedBuffer = null;

        // Try 1: Inflate Raw
        try {
            decompressedBuffer = zlib.inflateRawSync(compressedBuffer);
        } catch (e1) {
            // Try 2: Standard Inflate (with header)
            try {
                decompressedBuffer = zlib.inflateSync(compressedBuffer);
            } catch (e2) {
                // Try 3: Gunzip
                try {
                    decompressedBuffer = zlib.gunzipSync(compressedBuffer);
                } catch (e3) {
                    console.error("All decompression methods failed.");
                    return res.status(400).json({ 
                        success: false, 
                        message: "Decompression failed. Data cut ya corrupt hai.", 
                        receivedLength: cleanDigits.length,
                        error: e1.message 
                    });
                }
            }
        }

        // 3. Byte 255 Delimiter Parsing
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

        // 4. Extract Text & Photo
        const textDataString = parts[1] ? parts[1].toString('utf8') : '';
        const textFields = textDataString.split(',');
        const photoBase64 = parts[2] ? `data:image/jpeg;base64,${parts[2].toString('base64')}` : null;

        return res.status(200).json({
            success: true,
            data: {
                referenceId: textFields[0] || '',
                name: textFields[1] || '',
                dob: textFields[2] || '',
                gender: textFields[3] || '',
                address: {
                    house: textFields[5] || '',
                    street: textFields[6] || '',
                    vtc: textFields[9] || '',
                    district: textFields[10] || '',
                    state: textFields[11] || '',
                    pincode: textFields[12] || ''
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
