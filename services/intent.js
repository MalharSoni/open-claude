class IntentDetector {
  constructor() {
    this.intents = {
      booking: {
        keywords: ['book', 'appointment', 'schedule', 'reserve', 'reservation', 'table'],
        patterns: [/book.*table/i, /make.*reservation/i, /schedule.*appointment/i]
      },
      hours: {
        keywords: ['hours', 'open', 'close', 'time', 'when', 'operating'],
        patterns: [/what.*hours/i, /when.*open/i, /are you open/i, /open.*sunday/i, /close.*time/i]
      },
      location: {
        keywords: ['where', 'location', 'address', 'directions', 'find'],
        patterns: [/where.*located/i, /what.*address/i, /how.*get there/i, /directions/i]
      },
      delivery: {
        keywords: ['deliver', 'delivery', 'bring', 'ship'],
        patterns: [/do you deliver/i, /delivery.*area/i, /deliver.*to/i]
      },
      menu: {
        keywords: ['menu', 'food', 'pizza', 'price', 'cost', 'special'],
        patterns: [/what.*menu/i, /show.*menu/i, /pizza.*types/i, /what.*serve/i]
      },
      payment: {
        keywords: ['pay', 'payment', 'credit', 'cash', 'card'],
        patterns: [/payment.*method/i, /accept.*card/i, /pay.*cash/i]
      },
      halal: {
        keywords: ['halal', 'meat', 'pork'],
        patterns: [/is.*halal/i, /halal.*certified/i]
      },
      generic: {
        keywords: ['hello', 'hi', 'help', 'thanks', 'bye'],
        patterns: [/^(hi|hello|hey)/i, /thank/i, /bye/i]
      }
    };
  }

  detectIntent(userInput) {
    const input = userInput.toLowerCase();
    let scores = {};

    for (const [intentName, intentConfig] of Object.entries(this.intents)) {
      let score = 0;

      for (const keyword of intentConfig.keywords) {
        if (input.includes(keyword)) {
          score += 2;
        }
      }

      for (const pattern of intentConfig.patterns) {
        if (pattern.test(input)) {
          score += 3;
        }
      }

      if (score > 0) {
        scores[intentName] = score;
      }
    }

    if (Object.keys(scores).length === 0) {
      return 'fallback';
    }

    const topIntent = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    return topIntent;
  }

  generateResponse(intent, businessData) {
    const responses = {
      booking: () => {
        return `I'd be happy to help you with a reservation! We accept ${businessData.services.join(', ')}. You can call us at ${businessData.phone} to make a reservation, or would you like me to check availability for you?`;
      },

      hours: () => {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const todayHours = businessData.hours[today] || 'closed';

        return `We're open today (${today}) from ${todayHours}. Our full hours are:\n` +
          Object.entries(businessData.hours)
            .map(([day, hours]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${hours}`)
            .join('\n');
      },

      location: () => {
        return `We're located at ${businessData.location}. ${businessData.special_notes.parking ? `${businessData.special_notes.parking}.` : ''} Would you like directions?`;
      },

      delivery: () => {
        return `Yes, we deliver to ${businessData.delivery_areas.join(', ')}. Our delivery fee is ${businessData.delivery_fee}. Would you like to place a delivery order?`;
      },

      menu: () => {
        return `Our specialties include ${businessData.specialties.join(', ')}. We have ${businessData.special_notes.vegetarian_options ? 'vegetarian options available' : 'various options'}. Would you like to hear about our current specials?`;
      },

      payment: () => {
        return `We accept ${businessData.payment_methods.join(', ')} as payment methods. Is there a specific payment method you'd like to use?`;
      },

      halal: () => {
        return businessData.special_notes.halal
          ? `Yes, all our meat is 100% halal certified. We take pride in serving halal food to our community.`
          : `Please contact us at ${businessData.phone} for information about our meat sourcing.`;
      },

      generic: () => {
        return `Hello! Welcome to ${businessData.business_name}. How can I help you today? I can assist with reservations, hours, delivery, or answer any questions about our menu.`;
      },

      fallback: () => {
        return `I'm sorry, I didn't quite understand that. I can help you with:\n` +
          `• Making a reservation\n` +
          `• Our hours and location\n` +
          `• Delivery information\n` +
          `• Menu and specials\n` +
          `• Payment methods\n` +
          `How can I assist you today?`;
      }
    };

    const responseGenerator = responses[intent] || responses.fallback;
    return responseGenerator();
  }
}

module.exports = new IntentDetector();