# Complete Twilio Streaming Setup Guide

## ✅ Current Status

**Ngrok Tunnel Active**: `https://9b011d2ba5a2.ngrok-free.app` → `localhost:3001`

**Servers Running**:
- ✅ Main API Server: `localhost:3001`
- ✅ Streaming WebSocket Server: `localhost:8080`
- ✅ Ngrok Tunnel: `https://9b011d2ba5a2.ngrok-free.app`

---

## 🔧 Twilio Configuration Steps

### Step 1: Access Twilio Console
1. Go to https://console.twilio.com/
2. Log in to your Twilio account

### Step 2: Configure Phone Number Webhook

#### Option A: Via Console (Recommended)
1. **Navigate to Phone Numbers**:
   - Console → Develop → Phone Numbers → Manage → Active numbers

2. **Select Your Phone Number**:
   - Click on your Twilio phone number

3. **Configure Voice Webhook**:
   ```
   Webhook URL: https://9b011d2ba5a2.ngrok-free.app/stream
   HTTP Method: POST
   ```

4. **Save Configuration**

#### Option B: Via Twilio CLI
```bash
# Install Twilio CLI if not installed
npm install -g twilio-cli

# Login to Twilio
twilio login

# Update phone number webhook
twilio phone-numbers:update +1YOURNUMBER \
  --voice-url="https://9b011d2ba5a2.ngrok-free.app/stream" \
  --voice-method="POST"
```

### Step 3: Test Configuration

#### Test Webhook Endpoint
```bash
curl -X POST https://9b011d2ba5a2.ngrok-free.app/stream \
  -d "From=%2B15551234567" \
  -d "To=%2B15559876543" \
  -d "CallSid=CAtest123"
```

**Expected Response**: TwiML with WebSocket stream configuration

#### Test Stream Status
```bash
curl https://9b011d2ba5a2.ngrok-free.app/stream/status
```

---

## 📞 Testing the Complete Flow

### 1. Make a Test Call
- Call your Twilio phone number
- You should hear: *"Connecting you to our AI receptionist. Please wait a moment."*

### 2. Expected Behavior
1. **Initial Response**: Twilio plays connection message
2. **WebSocket Connection**: System attempts to connect to streaming server
3. **AI Greeting**: *"Hello! Welcome to Pizza Karachi. I'm your AI assistant. How can I help you today?"*
4. **Real-time Conversation**: Speak naturally, AI responds with business info

### 3. Monitor Logs
**Main Server Logs**:
```bash
# Check npm run dev output for:
[STREAM-VOICE] Incoming streaming call from +1234567890...
[STREAM-VOICE] Streaming TwiML generated, connecting to: wss://...
```

**Streaming Server Logs**:
```bash
# Check npm run stream output for:
[STREAM] New WebSocket connection established
[STREAM] Starting stream for call: CA...
[STT] Processing audio chunks...
[AI] Generated response...
[TTS] Audio sent to caller
```

---

## 🛠️ WebSocket Connection Details

**Current Configuration**:
- **Twilio Stream Webhook**: `https://9b011d2ba5a2.ngrok-free.app/stream`
- **WebSocket Target**: `wss://9b011d2ba5a2.ngrok-free.app` (needs proxy setup)

**Note**: Currently using single ngrok tunnel. WebSocket connections will need to be proxied through the main server or require separate tunnel.

---

## 🔍 Troubleshooting

### Common Issues

**1. Webhook Not Receiving Calls**
```bash
# Check if webhook URL is accessible
curl -I https://9b011d2ba5a2.ngrok-free.app/stream
# Should return 200 OK
```

**2. WebSocket Connection Fails**
- Check streaming server is running: `npm run stream`
- Verify port 8080 is not blocked
- Check ngrok tunnel status

**3. Audio Issues**
- Verify OpenAI API key is configured
- Check microphone permissions
- Monitor STT/TTS logs

### Debug Commands
```bash
# Check all active tunnels
curl -s http://127.0.0.1:4040/api/tunnels | jq

# Test streaming status
curl https://9b011d2ba5a2.ngrok-free.app/stream/status

# Monitor WebSocket connections
# (Check streaming server console output)
```

---

## 🚀 Production Deployment

For production deployment:

1. **Deploy to Cloud Provider** (AWS, GCP, Azure)
2. **Use Real Domain** instead of ngrok
3. **Configure SSL Certificate**
4. **Set up Load Balancing** for WebSocket connections
5. **Monitor with Logging Service**

---

## 📊 Key Endpoints

| Endpoint | Purpose | Method |
|----------|---------|---------|
| `/stream` | Twilio webhook for streaming calls | POST |
| `/stream/status` | Streaming service health check | GET |
| `/stream/test` | Test streaming configuration | POST |
| `/health` | Main service health | GET |

**Base URL**: `https://9b011d2ba5a2.ngrok-free.app`

---

## 🎯 Next Steps

1. **Configure Twilio webhook** using the URL above
2. **Test with phone call** to verify end-to-end flow
3. **Monitor logs** for any connection issues
4. **Adjust audio processing** parameters if needed

The streaming voice AI system is ready for live testing!