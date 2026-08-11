const express = require('express');
const cors = require('cors');
const zlib = require('zlib');

const app = express();

// Render ke dwara diya gaya dynamic PORT use karein
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Safe Decompress Function (Fixes header check error)
function safeDecompress(inputBuffer) {
  let buffer = Buffer.isBuffer(inputBuffer)
    ? inputBuffer
    : Buffer.from(inputBuffer, 'binary');

  try {
    return zlib.inflateSync(buffer);
  } catch (err1) {
    try {
      return zlib.inflateRawSync(buffer);
    } catch (err2) {
      try {
        return zlib.gunzipSync(buffer);
      } catch (err3) {
        throw new Error("Invalid or Corrupted QR Header Data");
      }
    }
  }
}

// Health Check Endpoint (Render checks this)
app.get('/', (req, res) => {
  res.status(200).send("Server is running successfully!");
});

// Main QR Scan Endpoint
app.post('/api/scan', (req, res) => {
  try {
    const { qrRawData } = req.body;

    if (!qrRawData) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'No QR data provided in req.body' 
      });
    }

    // Convert input to Buffer
    const buffer = Buffer.from(qrRawData, 'base64');
    
    // Decompress safely
    const decompressed = safeDecompress(buffer);

    res.json({
      status: 'success',
      data: decompressed.toString('utf-8')
    });

  } catch (error) {
    console.error("Processing Error:", error.message);
    res.status(500).json({
      status: 'error',
      message: error.message || "Failed to decompress QR data"
    });
  }
});

// Render par chalane ke liye 0.0.0.0 par bind karna zaroori hai
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
