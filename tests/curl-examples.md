# /call Endpoint Test Examples

## Basic Usage

### Hours Query
```bash
curl -X POST "http://localhost:3001/call" \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Are you open on Sundays?",
    "business_id": "pizzakarachi"
  }'
```

Expected response:
```json
{
  "text_response": "We're open today (saturday) from 12pm–10pm. Our full hours are:\nMonday: 12pm–9pm...",
  "intent": "hours",
  "business_id": "pizzakarachi",
  "audio_available": false
}
```

### Delivery Query
```bash
curl -X POST "http://localhost:3001/call" \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Do you deliver to North York?",
    "business_id": "pizzakarachi"
  }'
```

### Menu/Vegetarian Query
```bash
curl -X POST "http://localhost:3001/call" \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Do you have vegetarian options?",
    "business_id": "pizzakarachi"
  }'
```

### Halal Inquiry
```bash
curl -X POST "http://localhost:3001/call" \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Is your meat halal?",
    "business_id": "pizzakarachi"
  }'
```

### Location Query
```bash
curl -X POST "http://localhost:3001/call" \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Where are you located?",
    "business_id": "pizzakarachi"
  }'
```

## Error Cases

### Invalid Business ID
```bash
curl -X POST "http://localhost:3001/call" \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "What are your hours?",
    "business_id": "nonexistent"
  }'
```

Expected response:
```json
{
  "error": "Business not found",
  "message": "No data found for business_id: nonexistent"
}
```

### Missing Required Fields
```bash
curl -X POST "http://localhost:3001/call" \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "What are your hours?"
  }'
```

Expected response:
```json
{
  "error": "Invalid request",
  "details": "\"business_id\" is required"
}
```

## Audio Testing

When `ELEVENLABS_API_KEY` is configured in `.env`:

```bash
curl -X POST "http://localhost:3001/call" \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "What are your hours?",
    "business_id": "pizzakarachi"
  }'
```

Expected response with audio:
```json
{
  "text_response": "We're open today...",
  "intent": "hours",
  "business_id": "pizzakarachi",
  "audio_available": true,
  "audio_url": "/audio/pizzakarachi-1699999999999.mp3"
}
```

### Play Audio File
```bash
# Open in browser
open http://localhost:3001/audio/pizzakarachi-1699999999999.mp3

# Or download
curl -o response.mp3 http://localhost:3001/audio/pizzakarachi-1699999999999.mp3
```

## Intent Coverage

The system detects these intents:

- **booking**: "Can I make a reservation?", "Book a table"
- **hours**: "What are your hours?", "Are you open?"
- **location**: "Where are you located?", "What's your address?"
- **delivery**: "Do you deliver?", "Delivery areas?"
- **menu**: "What's on the menu?", "Vegetarian options?"
- **payment**: "What payment methods?", "Do you accept cards?"
- **halal**: "Is your meat halal?", "Halal certified?"
- **generic**: "Hello", "Hi there"
- **fallback**: Unrecognized input

## Performance Testing

### Rapid Fire Test
```bash
for i in {1..5}; do
  curl -X POST "http://localhost:3001/call" \
    -H "Content-Type: application/json" \
    -d '{"user_input": "What are your hours?", "business_id": "pizzakarachi"}' \
    -w "Time: %{time_total}s\n" -o /dev/null -s
done
```