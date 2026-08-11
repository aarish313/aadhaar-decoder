const zlib = require('zlib');

// Aadhaar QR Buffer ko Safely Decompress karne ka function
function safeDecompress(inputBuffer) {
  // Ensure input is a valid Buffer
  let buffer = Buffer.isBuffer(inputBuffer) 
    ? inputBuffer 
    : Buffer.from(inputBuffer, 'binary');

  // 1. Try Standard ZLIB Inflate
  try {
    return zlib.inflateSync(buffer);
  } catch (err1) {
    // 2. Try RAW Deflate (If header check failed)
    try {
      return zlib.inflateRawSync(buffer);
    } catch (err2) {
      // 3. Try GZIP
      try {
        return zlib.gunzipSync(buffer);
      } catch (err3) {
        console.error("Decompression Error:", err3.message);
        throw new Error("Invalid or Corrupted QR Header Data");
      }
    }
  }
}

// Example API Handler inside server.js
app.post('/api/scan', (req, res) => {
  try {
    const { qrRawData } = req.body;

    if (!qrRawData) {
      return res.status(400).json({ error: "No QR data received" });
    }

    // Convert incoming data to Buffer properly
    // Note: Agar data BigInteger / Decimal string hai toh Byte Array me convert karein
    const buffer = Buffer.from(qrRawData, 'base64'); 

    // Decompress safely without header crash
    const decompressedData = safeDecompress(buffer);

    console.log("Decompressed Successfully!");

    // Proceed with parsing JP2 photo & XML text...
    res.json({ status: "success", message: "Data processed" });

  } catch (error) {
    console.error("Render Log Error:", error.message);
    res.status(500).json({ 
      status: "error", 
      message: "Header check failed or invalid data structure." 
    });
  }
});
