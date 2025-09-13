# AI Receptionist Backend

A complete Node.js backend for an AI receptionist agent with voice calls and calendar booking functionality.

## Features

- 📅 **Calendar Booking**: Google Calendar integration with availability checking
- 📞 **Voice Calls**: TTS support via ElevenLabs or OpenAI
- 🧠 **Knowledge Base**: Configurable business information and policies
- 🔐 **Validation**: Request validation with Joi
- 🛡️ **Security**: Helmet.js security headers

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Run the server**
   ```bash
   npm run dev  # Development
   npm start    # Production
   ```

## API Endpoints

### Booking (`/book`)
- `GET /book/availability?date=YYYY-MM-DD&duration=30` - Check availability
- `POST /book` - Create booking
- `DELETE /book/:eventId` - Cancel booking

### Voice Calls (`/call`)
- `POST /call` - Start voice conversation
- `POST /call/tts` - Convert text to speech
- `GET /call/conversation/:id` - Get conversation history

### Health Checks
- `GET /health` - Server health
- `GET /book/health` - Booking service health
- `GET /call/health` - Voice service health

## Configuration

### Google Calendar Setup
1. Create a Google Cloud Project
2. Enable the Google Calendar API
3. Create a service account and download the JSON key
4. Add the service account email to your calendar with edit permissions
5. Set `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` in your `.env`

### TTS Setup (Choose One)

**ElevenLabs** (Recommended)
```bash
ELEVENLABS_API_KEY=your-api-key
ELEVENLABS_VOICE_ID=voice-id  # Optional
```

**OpenAI**
```bash
OPENAI_API_KEY=your-api-key
```

## Project Structure

```
/
├── index.js                    # Main Express server
├── routes/
│   ├── book.js                 # Booking endpoints
│   └── call.js                 # Voice call endpoints
├── services/
│   └── calendarService.js      # Google Calendar integration
├── data/
│   └── business_knowledge.json # Business info & policies
└── package.json
```

## Example Usage

### Book an Appointment
```javascript
const booking = await fetch('/book', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    customerPhone: '+1234567890',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T11:00:00Z',
    serviceType: 'consultation',
    notes: 'First time consultation'
  })
});
```

### Start Voice Conversation
```javascript
const response = await fetch('/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerName: 'Jane Smith',
    intent: 'booking',
    message: 'I want to schedule an appointment'
  })
});
```

## Customization

Edit `data/business_knowledge.json` to customize:
- Business information
- Operating hours
- Services offered
- Policies
- Common Q&A

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Check all endpoints
curl http://localhost:3000/health
curl http://localhost:3000/book/health
curl http://localhost:3000/call/health
```