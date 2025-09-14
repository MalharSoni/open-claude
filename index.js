const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const bookRouter = require('./routes/book');
const callRouter = require('./routes/call');
const audioCleanup = require('./services/audioCleanup');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static audio files
app.use('/audio', express.static(path.join(__dirname, 'public', 'audio')));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'AI Receptionist Backend'
  });
});

app.use('/book', bookRouter);
app.use('/call', callRouter);

// Audio management endpoints
app.get('/audio/cleanup', async (req, res) => {
  try {
    const result = await audioCleanup.cleanupOldFiles();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/audio/info', async (req, res) => {
  try {
    const info = await audioCleanup.getStorageInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

app.listen(PORT, () => {
  console.log(`🤖 AI Receptionist Backend running on port ${PORT}`);
  console.log(`📅 Booking endpoint: http://localhost:${PORT}/book`);
  console.log(`📞 Call endpoint: http://localhost:${PORT}/call`);
  console.log(`🎵 Audio info: http://localhost:${PORT}/audio/info`);
  console.log(`✅ No authentication required - using mock booking service`);

  // Start automatic audio cleanup (every 6 hours)
  if (process.env.AUDIO_CLEANUP !== 'false') {
    audioCleanup.startAutoCleanup(6);
  }
});

module.exports = app;