# Real-Time AI Receptionist (Rondah.ai Style)

A high-performance real-time AI receptionist that connects callers directly to an AI agent with no robotic greetings or transfers. Built with Twilio Media Streams, OpenAI Whisper STT, ElevenLabs TTS, and GPT-4 for natural conversations.

## 🎯 Features

- **Instant AI Connection** - No robotic greetings, calls connect directly to AI
- **Real-Time Voice Processing** - 0.8-second audio buffering for fast responses
- **ElevenLabs High-Quality TTS** - Premium voice synthesis with OpenAI fallback
- **OpenAI Whisper STT** - Accurate speech-to-text transcription
- **Contextual Conversations** - GPT-4 powered responses with business knowledge
- **Single Ngrok Tunnel** - WebSocket proxy for simplified deployment

## 🏗️ Architecture

```
Phone Call → Twilio → /stream (TwiML) → WebSocket Stream → AI Processing
                ↓                           ↓
        Immediate Stream Start        Audio Buffer (0.8s)
                ↓                           ↓
          No "Please Hold"             Whisper STT
                ↓                           ↓
           Direct to AI               GPT-4 Response
                ↓                           ↓
        Natural Conversation        ElevenLabs TTS
                ↓                           ↓
          Real-Time Audio          Streamed to Caller
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install express ws twilio openai node-fetch@2 dotenv cors helmet http-proxy-middleware
```

### 2. Environment Setup
Create `.env` file:
```bash
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
PORT=3001
```

### 3. Start Servers

**Terminal 1 - TwiML Server:**
```bash
npm run twiml
```

**Terminal 2 - Real-Time Streaming Server:**
```bash
npm run realtime
```

**Terminal 3 - Ngrok Tunnel:**
```bash
ngrok http 3001 --log stdout
```

### 4. Configure Twilio

1. Copy ngrok URL (e.g., `https://abc123.ngrok-free.app`)
2. In Twilio Console → Phone Numbers → Active Numbers
3. Set Voice Webhook URL: `https://abc123.ngrok-free.app/stream`
4. Set HTTP Method: POST

## 📞 How It Works

### Call Flow
1. **Call Received** - Twilio receives incoming call
2. **Immediate TwiML** - Returns `<Start><Stream>` with no delays
3. **WebSocket Connection** - Establishes real-time audio stream
4. **AI Greeting** - "Hi there! This is Pizza Karachi's AI assistant..."
5. **Conversation Loop**:
   - Buffer 0.8s of audio (40 chunks)
   - Convert μ-law → WAV → Whisper STT
   - Generate GPT-4 response with business context
   - ElevenLabs TTS → Stream to caller in 4KB chunks

### Audio Processing
- **Twilio Format**: μ-law encoded, 8kHz, 20ms chunks
- **Buffer Size**: 40 chunks (0.8 seconds) for responsiveness
- **Conversion**: μ-law → 16-bit PCM → WAV for Whisper
- **Streaming**: 4KB chunks with 8ms delays for real-time feel

### Business Intelligence
- **Menu Knowledge** - Detailed pizza menu with prices
- **Hours & Location** - Operating hours and delivery info
- **Order Taking** - Can collect customer details and preferences
- **Conversation Memory** - Maintains context throughout call

## 🔧 Configuration Files

### `twiml-server.js`
- Handles Twilio webhooks
- Returns immediate stream TwiML (no robotic greeting)
- WebSocket proxy for single ngrok tunnel

### `streaming-server-v2.js`
- Real-time WebSocket audio processing
- μ-law to WAV conversion for Whisper
- ElevenLabs TTS with OpenAI fallback
- Chunked audio streaming to Twilio

### `business-data.json`
- Complete business information
- Menu items with prices
- Hours, delivery, promotions

## 🎭 Voice Configuration

### ElevenLabs Settings
- **Voice ID**: `21m00Tcm4TlvDq8ikWAM` (Rachel)
- **Stability**: 0.6 (balanced naturalness)
- **Similarity Boost**: 0.8 (consistent voice)
- **Style**: 0.2 (conversational)
- **Speaker Boost**: Enabled

### OpenAI TTS Fallback
- **Model**: `tts-1-hd` (high quality)
- **Voice**: `nova` (friendly female)
- **Format**: MP3

## 📊 Performance Metrics

- **Response Time**: ~0.8-1.2 seconds end-to-end
- **Audio Quality**: 8kHz, 16-bit (phone quality)
- **Chunk Size**: 4KB for streaming
- **Memory**: Conversation history per CallSid
- **Cleanup**: Automatic session management

## 🧪 Testing

### Manual Testing
1. Call your Twilio number: `(672) 207-2526`
2. Should hear immediate AI greeting
3. Test conversation flow:
   - "What are your hours?"
   - "I'd like to order a pizza"
   - "What do you recommend?"

### Webhook Testing
```bash
curl -X POST https://your-ngrok-url.ngrok-free.app/stream \
  -d "From=%2B15551234567" \
  -d "To=%2B16722072526" \
  -d "CallSid=CAtest123"
```

Should return TwiML with `<Start><Stream>` immediately.

## 🚨 Troubleshooting

### Common Issues

**1. "Connecting you to..." Message**
- TwiML contains `<Say>` tag - remove all Say elements
- Stream should start immediately with no delays

**2. Call Ends After Greeting**
- Check WebSocket connection in streaming server logs
- Verify audio buffer processing (should see "Processing X chunks")
- Ensure ElevenLabs/OpenAI TTS is working

**3. WebSocket Connection Failed**
- Verify ngrok tunnel is active
- Check WebSocket proxy in twiml-server.js
- Confirm streaming server is running on port 8080

**4. Poor Audio Quality**
- Check μ-law conversion in convertMulawToWav()
- Verify 8kHz sample rate for Twilio compatibility
- Test with different chunk sizes

### Debug Logs
```bash
# Enable verbose logging
DEBUG=* npm run realtime
```

Look for:
- `🔗 New WebSocket connection established`
- `🎧 Processing X audio chunks`
- `📝 Transcribed: "user speech"`
- `🤖 AI Response: "ai response"`
- `📤 Audio streaming to Twilio initiated`

## 🔒 Security

- **API Keys** - Stored in environment variables
- **CORS** - Configured for Twilio webhooks only
- **Helmet** - Security headers enabled
- **Input Validation** - Sanitize user transcriptions
- **Rate Limiting** - Consider adding for production

## 📈 Scaling

### Production Considerations
- **Load Balancing** - Multiple streaming server instances
- **Redis** - Shared session storage across instances
- **Database** - Persistent conversation history
- **CDN** - Audio file caching
- **Monitoring** - Real-time performance metrics

### Performance Optimization
- **WebSocket Pooling** - Reuse connections
- **Audio Caching** - Cache common responses
- **GPU Processing** - Faster Whisper inference
- **Edge Deployment** - Reduce latency

## 🎯 Customization

### Business Configuration
Edit `business-data.json`:
- Update menu items and prices
- Change business hours
- Modify location and delivery info
- Add seasonal promotions

### Voice Personality
Modify system prompt in `streaming-server-v2.js`:
```javascript
const systemPrompt = `You are a friendly AI receptionist for ${businessData.name}.
Keep responses under 30 words. Be warm and helpful...`;
```

### Audio Settings
Adjust in `streaming-server-v2.js`:
```javascript
// Buffer size (lower = faster, higher = better accuracy)
if (buffer.length >= 40) { // 0.8 seconds

// Streaming chunk size
const chunkSize = 4096; // 4KB chunks

// Streaming delay
setTimeout(sendChunk, 8); // 8ms delay
```

---

**📞 Ready to deploy! Your AI receptionist will answer calls like a real person, not a robotic phone system.**