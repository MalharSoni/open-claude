const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const bookRouter = require('./routes/book');
const callRouter = require('./routes/call');
const authRouter = require('./routes/auth');
const calendarService = require('./services/calendarService');

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
app.use('/auth', authRouter);

// OAuth callback endpoint
app.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h2 style="color: #d32f2f;">❌ Authorization Failed</h2>
            <p>No authorization code received from Google.</p>
            <a href="/auth" style="color: #1976d2;">Try again</a>
          </body>
        </html>
      `);
    }

    await calendarService.handleCallback(code);

    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #2e7d32;">✅ Authorization Successful!</h2>
          <p>Google Calendar has been connected successfully.</p>
          <p>You can now close this window and use the booking system.</p>
          <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px;">
            <h3>Next Steps:</h3>
            <ul style="text-align: left; display: inline-block;">
              <li>Test booking endpoints: <code>GET /book/availability</code></li>
              <li>Create appointments: <code>POST /book</code></li>
              <li>Check auth status: <code>GET /auth/status</code></li>
            </ul>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #d32f2f;">❌ Authorization Error</h2>
          <p>Failed to complete authorization: ${error.message}</p>
          <a href="/auth" style="color: #1976d2;">Try again</a>
        </body>
      </html>
    `);
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

app.listen(PORT, async () => {
  console.log(`🤖 AI Receptionist Backend running on port ${PORT}`);
  console.log(`📅 Booking endpoint: http://localhost:${PORT}/book`);
  console.log(`📞 Call endpoint: http://localhost:${PORT}/call`);
  console.log(`🔐 Auth endpoint: http://localhost:${PORT}/auth`);

  // Initialize calendar service
  try {
    await calendarService.initialize();
  } catch (error) {
    console.log(`⚠️  Calendar service initialization: ${error.message}`);
  }
});

module.exports = app;