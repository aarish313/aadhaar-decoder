const express = require('express');
const zlib = require('zlib');

const app = express();

// Large QR data payload handle karne ke liye limit badhayi gayi hai
app.use(express.json({ limit: '10mb' }));

// Helper function: BigInt / Numeric String ko Byte Buffer me convert karne ke liye
function bigIntToBytes(bigIntString) {
    let bigInt = BigInt(bigIntString);
    const hex = bigInt.toString(16);
    const evenHex = hex.length % 2 === 0 ? hex : '0' + hex;
    return Buffer.from(evenHex, 'hex');
}

// Main API Route
app.post('/api/decode-aadhaar', (req, res) => {
    try {
        const { qrData } = req.body;

        if (!qrData) {
            return res.status(400).json({ 
                success: false, 
                message: 'qrData field blank hai' 
            });
        }

        // 1. BigInt String ko Byte Buffer me convert karein
        const compressedBuffer = bigIntToBytes(qrData);

        // 2. Zlib Raw Deflate se Decompress karein
        const decompressedBuffer = zlib.inflateRawSync(compressedBuffer);

        // 3. Byte 255 (0xFF) delimiter se Data split karein
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
        if (currentPart.length > 0) {
            parts.push(Buffer.from(currentPart));
        }

        // 4. Text aur Photo Parse karein
        const textDataString = parts[1] ? parts[1].toString('utf8') : '';
        const textFields = textDataString.split(',');

        // Photo Byte Array ko Base64 String me convert karein
        const photoBase64 = parts[2] ? `data:image/jpeg;base64,${parts[2].toString('base64')}` : null;

        // Clean JSON Output
        return res.json({
            success: true,
            data: {
                referenceId: textFields[0] || '',
                name: textFields[1] || '',
                dob: textFields[2] || '',
                gender: textFields[3] || '',
                address: {
                    house: textFields[5] || '',
                    street: textFields[6] || '',
                    landmark: textFields[7] || '',
                    locality: textFields[8] || '',
                    vtc: textFields[9] || '',
                    district: textFields[10] || '',
                    state: textFields[11] || '',
                    pincode: textFields[12] || ''
                },
                photoBase64: photoBase64
            }
        });

    } catch (error) {
        console.error('Decoding Error:', error.message);
        return res.status(500).json({ 
            success: false, 
            message: 'QR Code decode nahi ho paya. Invalid or Corrupted QR data.', 
            error: error.message 
        });
    }
});

// Server Port Setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});