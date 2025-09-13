const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class CalendarService {
  constructor() {
    this.calendar = null;
    this.oauth2Client = null;
    this.initialized = false;
    this.tokenPath = path.join(__dirname, '../data/google-tokens.json');
  }

  async initialize() {
    try {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error('Google OAuth credentials not found in environment variables');
      }

      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/callback'
      );

      // Try to load existing tokens
      await this.loadTokens();

      if (this.oauth2Client.credentials && this.oauth2Client.credentials.access_token) {
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
        this.initialized = true;
        console.log('✅ Google Calendar service initialized with existing tokens');
      } else {
        console.log('⚠️ Google Calendar needs authorization. Use /auth endpoint to authenticate.');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Google Calendar:', error.message);
      throw error;
    }
  }

  async loadTokens() {
    try {
      if (fs.existsSync(this.tokenPath)) {
        const tokens = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
        this.oauth2Client.setCredentials(tokens);

        // Check if token needs refresh
        if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
          await this.refreshTokens();
        }
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  }

  async saveTokens(tokens) {
    try {
      fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2));
      console.log('✅ Tokens saved successfully');
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }

  async refreshTokens() {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      await this.saveTokens(credentials);
      console.log('✅ Tokens refreshed successfully');
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      throw error;
    }
  }

  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async handleCallback(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      await this.saveTokens(tokens);

      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      this.initialized = true;

      console.log('✅ Google Calendar authenticated successfully');
      return { success: true };
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      throw error;
    }
  }

  async getAvailableSlots(date, duration = 30) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      const startOfDay = new Date(date);
      startOfDay.setHours(9, 0, 0, 0); // 9 AM

      const endOfDay = new Date(date);
      endOfDay.setHours(17, 0, 0, 0); // 5 PM

      const response = await this.calendar.events.list({
        calendarId,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      const bookedSlots = response.data.items || [];
      const availableSlots = this.calculateAvailableSlots(startOfDay, endOfDay, bookedSlots, duration);

      return availableSlots;
    } catch (error) {
      console.error('Error fetching available slots:', error);
      throw new Error('Failed to fetch available time slots');
    }
  }

  calculateAvailableSlots(startOfDay, endOfDay, bookedSlots, duration) {
    const slots = [];
    const slotDuration = duration * 60 * 1000; // Convert to milliseconds

    let currentTime = new Date(startOfDay);
    const endTime = new Date(endOfDay);

    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration);

      if (slotEnd > endTime) break;

      const isSlotAvailable = !bookedSlots.some(event => {
        const eventStart = new Date(event.start.dateTime || event.start.date);
        const eventEnd = new Date(event.end.dateTime || event.end.date);

        return (currentTime < eventEnd && slotEnd > eventStart);
      });

      if (isSlotAvailable) {
        slots.push({
          startTime: currentTime.toISOString(),
          endTime: slotEnd.toISOString(),
          duration: duration
        });
      }

      currentTime = new Date(currentTime.getTime() + slotDuration);
    }

    return slots;
  }

  async createBooking({ customerName, customerEmail, customerPhone, date, startTime, endTime, serviceType, notes }) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

      const event = {
        summary: `${serviceType} - ${customerName}`,
        description: `
Customer: ${customerName}
Email: ${customerEmail}
Phone: ${customerPhone}
Service: ${serviceType}
${notes ? `Notes: ${notes}` : ''}
        `.trim(),
        start: {
          dateTime: startTime,
          timeZone: process.env.TIMEZONE || 'America/New_York'
        },
        end: {
          dateTime: endTime,
          timeZone: process.env.TIMEZONE || 'America/New_York'
        },
        attendees: [
          { email: customerEmail, displayName: customerName }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 30 } // 30 minutes before
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId,
        resource: event,
        sendUpdates: 'all'
      });

      return {
        success: true,
        eventId: response.data.id,
        eventUrl: response.data.htmlLink,
        booking: {
          customerName,
          customerEmail,
          startTime,
          endTime,
          serviceType,
          status: 'confirmed'
        }
      };
    } catch (error) {
      console.error('Error creating booking:', error);
      throw new Error('Failed to create calendar booking');
    }
  }

  async cancelBooking(eventId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'all'
      });

      return { success: true, message: 'Booking cancelled successfully' };
    } catch (error) {
      console.error('Error cancelling booking:', error);
      throw new Error('Failed to cancel booking');
    }
  }
}

module.exports = new CalendarService();