const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(helmet());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Real-Time AI Receptionist' });
});

// Twilio webhook endpoint
app.post('/stream', (req, res) => {
  const { From, To, CallSid } = req.body;

  console.log(`📞 Incoming call from ${From} to ${To}, CallSid: ${CallSid}`);

  // Get ngrok URL from request headers
  const protocol = req.secure ? 'wss' : 'ws';
  const host = req.get('host');

  // Use same ngrok domain but different port for WebSocket
  const streamUrl = host.includes('ngrok')
    ? `wss://${host}/ws`
    : `${protocol}://${host.replace(':3001', ':8081')}/ws`;

  // TwiML response - NO robotic greeting, immediate stream
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${streamUrl}" name="RealTimeAI"/>
  </Start>
</Response>`;

  console.log(`🎙️  Streaming to: ${streamUrl}`);

  res.set('Content-Type', 'text/xml');
  res.send(twiml);
});

// Proxy WebSocket connections if using single ngrok tunnel
app.get('/ws', (req, res) => {
  res.status(426).send('Upgrade Required - WebSocket endpoint');
});

// Handle WebSocket upgrade for ngrok proxy
const server = require('http').createServer(app);
const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer({
  target: 'ws://localhost:8081',
  ws: true,
  changeOrigin: true
});

server.on('upgrade', (request, socket, head) => {
  console.log('🔄 WebSocket upgrade request - proxying to streaming server');

  proxy.ws(request, socket, head, (error) => {
    if (error) {
      console.error('❌ WebSocket proxy error:', error);
      socket.destroy();
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 TwiML Server running on port ${PORT}`);
  console.log(`📞 Webhook URL: http://localhost:${PORT}/stream`);
  console.log(`🔌 WebSocket proxy ready for /ws`);
});
