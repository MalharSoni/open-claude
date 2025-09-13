const express = require('express');
const calendarService = require('../services/calendarService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await calendarService.initialize();
    const authUrl = calendarService.getAuthUrl();

    res.json({
      message: 'Click the link below to authorize Google Calendar access',
      authUrl,
      instructions: [
        '1. Click the authorization URL',
        '2. Sign in with your Google account',
        '3. Grant calendar permissions',
        '4. You will be redirected back to complete setup'
      ]
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      error: 'Failed to generate authorization URL',
      message: error.message
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    await calendarService.initialize();

    res.json({
      authenticated: calendarService.initialized,
      message: calendarService.initialized
        ? 'Google Calendar is connected and ready'
        : 'Google Calendar authentication required. Use /auth to authenticate.'
    });
  } catch (error) {
    res.status(500).json({
      authenticated: false,
      error: 'Failed to check authentication status',
      message: error.message
    });
  }
});

module.exports = router;