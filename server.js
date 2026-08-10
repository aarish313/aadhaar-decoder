app.post('/api/decode-aadhaar', (req, res) => {
    try {
        let qrData = null;

        // 1. Agar JSON body aayi ho
        if (req.body && typeof req.body === 'object') {
            qrData = req.body.qrData;
        }

        // 2. Agar String ke roop me payload aaya ho
        if (!qrData && typeof req.body === 'string') {
            try {
                const parsed = JSON.parse(req.body);
                qrData = parsed.qrData || req.body;
            } catch (e) {
                qrData = req.body; // Raw numeric text string
            }
        }

        // 3. Agar fir bhi qrData nahi mila
        if (!qrData || qrData.trim() === '') {
            console.log("Error 400: Received Empty Payload. Body:", req.body);
            return res.status(400).json({ 
                success: false, 
                message: "qrData empty or invalid format" 
            });
        }

        // --- Decoding Logic ---
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
