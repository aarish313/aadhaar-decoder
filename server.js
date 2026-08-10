const express = require('express');
const zlib = require('zlib');

const app = express();

// MOST IMPORTANT: Kisi bhi tarah ke Content-Type data ko Text ke roop me catch karega
app.use(express.text({ type: '*/*', limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

function bigIntToBytes(bigIntString) {
    let bigInt = BigInt(bigIntString);
    const hex = bigInt.toString(16);
    const evenHex = hex.length % 2 === 0 ? hex : '0' + hex;
    return Buffer.from(evenHex, 'hex');
}

app.post('/api/decode-aadhaar', (req, res) => {
    try {
        let qrData = req.body;

        // 1. Agar data JSON String format me mila ho
        if (typeof qrData === 'string' && qrData.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(qrData);
                qrData = parsed.qrData || qrData;
            } catch (e) {
                // Ignore parse error
            }
        }

        // 2. Extra quotes ya spaces clean karein
        if (typeof qrData === 'string') {
            qrData = qrData.trim().replace(/^"|"$/g, '');
        }

        // 3. Data validation
        if (!qrData || qrData.length < 10) {
            console.log("Error: Data Empty ya invalid mila:", qrData);
            return res.status(400).json({ 
                success: false, 
                message: "QR Data khali ya invalid hai" 
            });
        }

        // --- Aadhaar Decoding Logic ---
        const compressedBuffer = bigIntToBytes(qrData);
        const decompressedBuffer = zlib.inflateRawSync(compressedBuffer);

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

        const textDataString = parts[1] ? parts[1].toString('utf8') : '';
        const textFields = textDataString.split(',');
        const photoBase64 = parts[2] ? `data:image/jpeg;base64,${parts[2].toString('base64')}` : null;

        return res.status(200).json({
            success: true,
            data: {
                name: textFields[1] || '',
                dob: textFields[2] || '',
                gender: textFields[3] || '',
                address: {
                    house: textFields[5] || '',
                    vtc: textFields[9] || '',
                    state: textFields[11] || '',
                    pincode: textFields[12] || ''
                },
                photoBase64: photoBase64
            }
        });

    } catch (error) {
        console.error("Decoding Error:", error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Decode error", 
            error: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
