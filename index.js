const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const bookRouter = require('./routes/book');
const callRouter = require('./routes/call');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'AI Receptionist Backend'
  });
});

app.use('/book', bookRouter);
app.use('/call', callRouter);

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
  console.log(`✅ No authentication required - using mock booking service`);
});

module.exports = app;