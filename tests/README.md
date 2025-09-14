# AI Receptionist Test Suite

This directory contains comprehensive tests for the AI Receptionist system covering all features, UI/UX functionality, and integration flows.

## Test Structure

### 1. **call-endpoint.test.js**
Original tests for the `/call` endpoint with intent detection and audio generation.
- **Coverage**: Intent detection, business data loading, audio generation, error handling
- **Tests**: 13 tests covering all 8 intents (hours, delivery, menu, halal, booking, payment, generic, fallback)

### 2. **api-endpoints.test.js**
Tests for the Business Management API used by the dashboard.
- **Coverage**: CRUD operations for business data, validation, error handling
- **Endpoints**: `/api/business/:id` (POST/GET/DELETE), `/api/businesses` (GET), `/api/health` (GET)
- **Tests**: Business creation, retrieval, listing, deletion, validation, error scenarios

### 3. **voice-integration.test.js**
Tests for Twilio voice webhook integration.
- **Coverage**: TwiML generation, speech processing, conversation flow, error handling
- **Features**: Initial calls, speech recognition, audio playback, conversation continuity
- **Tests**: First call handling, all intent processing via voice, TwiML structure validation

### 4. **tts-service.test.js**
Tests for the Text-to-Speech service with all providers.
- **Coverage**: Audio generation, file management, provider selection, error handling
- **Providers**: Open source TTS, ElevenLabs, OpenAI (when configured)
- **Tests**: Audio file creation, base64 encoding, provider switching, error recovery

### 5. **call-logic-service.test.js**
Tests for the centralized call logic service used across endpoints.
- **Coverage**: Intent processing, business data integration, audio URL generation
- **Features**: Reusable logic, absolute URL generation, error handling, performance
- **Tests**: All intents, URL handling, concurrent requests, error scenarios

### 6. **dashboard-ui.test.js**
Tests for dashboard functionality through API integration.
- **Coverage**: UI component integration, workflow simulation, error handling
- **Features**: Business upload, AI testing, audio playback, request logging
- **Tests**: Complete dashboard workflows, mobile responsiveness, performance

### 7. **integration-full-flow.test.js**
End-to-end integration tests covering complete business workflows.
- **Coverage**: Full onboarding flow, multi-business scenarios, performance benchmarks
- **Workflows**: Upload → Test → Voice integration, multi-tenant operations
- **Tests**: Complete business lifecycle, concurrent operations, system health

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Files
```bash
# API endpoints only
npm test tests/api-endpoints.test.js

# Voice integration only
npm test tests/voice-integration.test.js

# Full integration flows
npm test tests/integration-full-flow.test.js
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

## Test Categories

### 🔧 **Unit Tests**
- `tts-service.test.js` - TTS service functionality
- `call-logic-service.test.js` - Core call processing logic

### 🔗 **Integration Tests**
- `api-endpoints.test.js` - API endpoint integration
- `voice-integration.test.js` - Twilio webhook integration
- `call-endpoint.test.js` - Call endpoint with business data

### 🌐 **End-to-End Tests**
- `dashboard-ui.test.js` - Dashboard workflow simulation
- `integration-full-flow.test.js` - Complete system workflows

### 🎨 **UI/UX Tests**
- Dashboard component verification (in `dashboard-ui.test.js`)
- Mobile responsiveness checks
- Audio player functionality
- Form validation and error handling

## Test Data Management

### Cleanup Strategy
- All tests clean up generated files automatically
- Audio files are removed after each test suite
- Business data files are cleaned up per test
- No persistent test data between runs

### Test Business Data
Tests use isolated business configurations to avoid conflicts:
- `test-restaurant-api` - API testing
- `call-logic-test` - Call logic testing
- `full-integration-test` - Integration testing
- `dashboard-test-business` - Dashboard testing

## Environment Setup

### Required Environment Variables
```bash
# Optional - for testing real TTS providers
ELEVENLABS_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# Test environment (automatically set)
TTS_PROVIDER=open_source
NODE_ENV=test
```

### Test Database
Tests use the file-based business data storage:
- Location: `/data/` directory
- Format: JSON files named `{business_id}.json`
- Automatically managed by test cleanup

## Coverage Reports

The test suite aims for comprehensive coverage:

### API Coverage
- ✅ All REST endpoints
- ✅ Request/response validation
- ✅ Error handling scenarios
- ✅ Authentication (when implemented)

### Business Logic Coverage
- ✅ All 8 intent types
- ✅ Business data integration
- ✅ Audio generation pipeline
- ✅ Multi-business scenarios

### Integration Coverage
- ✅ Dashboard → API → Voice pipeline
- ✅ File upload and processing
- ✅ Real-time audio generation
- ✅ Concurrent request handling

### Performance Coverage
- ✅ Response time benchmarks
- ✅ Concurrent operation handling
- ✅ Memory usage validation
- ✅ File system operations

## Troubleshooting Tests

### Common Issues

1. **Port Conflicts**
   ```bash
   # Kill processes on test port
   lsof -ti:3001 | xargs kill -9
   ```

2. **File Permission Issues**
   ```bash
   # Ensure test directories are writable
   chmod -R 755 data/ public/audio/
   ```

3. **Audio File Conflicts**
   ```bash
   # Clean up audio files manually
   rm -rf public/audio/*test*
   ```

4. **TTS Provider Issues**
   ```bash
   # Ensure open source TTS is working
   export TTS_PROVIDER=open_source
   npm test
   ```

### Debug Mode
```bash
# Run tests with debug output
DEBUG=* npm test

# Run specific test with verbose output
npm test -- --verbose tests/integration-full-flow.test.js
```

## Contributing New Tests

### Test Naming Convention
- **Unit tests**: `{service-name}.test.js`
- **Integration tests**: `{feature-name}-integration.test.js`
- **UI tests**: `{component-name}-ui.test.js`
- **E2E tests**: `{workflow-name}-flow.test.js`

### Test Structure Template
```javascript
describe('Feature Name Tests', () => {
  beforeAll(() => {
    // Setup test environment
  });

  afterAll(() => {
    // Clean up test data
  });

  describe('Happy Path Tests', () => {
    test('should handle normal operation', async () => {
      // Test implementation
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle error gracefully', async () => {
      // Error test implementation
    });
  });

  describe('Performance Tests', () => {
    test('should complete within time limit', async () => {
      // Performance test implementation
    });
  });
});
```

### Adding New Test Categories
1. Create test file in appropriate category
2. Update this README with new coverage
3. Ensure cleanup procedures are implemented
4. Add to CI/CD pipeline if applicable

## Continuous Integration

### GitHub Actions Integration
Tests run automatically on:
- Pull requests
- Pushes to main branch
- Nightly schedules (for full integration tests)

### Quality Gates
- ✅ All tests must pass
- ✅ Coverage threshold: 80%+
- ✅ No memory leaks detected
- ✅ Performance benchmarks met

This comprehensive test suite ensures the AI Receptionist system is production-ready with full feature coverage, error handling, and performance validation.