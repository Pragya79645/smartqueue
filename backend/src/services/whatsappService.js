const axios = require('axios');
const logger = require('../utils/logger');

// WhatsApp Business API credentials (from environment)
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

/**
 * Send WhatsApp message using Meta Business API
 * @param {string} to - Recipient phone number (with country code)
 * @param {string} message - Message text
 * @returns {Promise<Object>} Send result
 */
exports.sendMessage = async (to, message) => {
  try {
    if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) {
      logger.warn('WhatsApp credentials not configured, using mock service');
      return mockSendMessage(to, message);
    }

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`WhatsApp message sent to ${to}`);
    return {
      success: true,
      messageId: response.data.messages[0].id,
      to: to
    };

  } catch (error) {
    logger.error('WhatsApp send error:', error.message);
    return mockSendMessage(to, message);
  }
};

/**
 * Send template message (for pre-approved templates)
 * @param {string} to - Recipient phone number
 * @param {string} templateName - Template name
 * @param {Array} parameters - Template parameters
 */
exports.sendTemplate = async (to, templateName, parameters = []) => {
  try {
    if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) {
      logger.warn('WhatsApp credentials not configured, using mock service');
      return mockSendMessage(to, `Template: ${templateName}`);
    }

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en'
          },
          components: parameters.length > 0 ? [{
            type: 'body',
            parameters: parameters.map(p => ({ type: 'text', text: p }))
          }] : []
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`WhatsApp template sent to ${to}: ${templateName}`);
    return {
      success: true,
      messageId: response.data.messages[0].id,
      to: to
    };

  } catch (error) {
    logger.error('WhatsApp template error:', error.message);
    return mockSendMessage(to, `Template: ${templateName}`);
  }
};

/**
 * Mock send for development/testing
 */
function mockSendMessage(to, message) {
  logger.info(`[MOCK] WhatsApp to ${to}: ${message}`);
  return {
    success: true,
    messageId: `mock_${Date.now()}`,
    to: to,
    mock: true
  };
}

/**
 * Format rush alert message
 */
exports.formatRushAlert = (counterData) => {
  const { counterId, queueSize, predictedSize, status } = counterData;
  
  return `🚨 *Rush Alert - Counter ${counterId}*\n\n` +
         `Current Queue: ${queueSize} people\n` +
         `Predicted: ${predictedSize || 'N/A'} people\n` +
         `Status: ${status.toUpperCase()}\n\n` +
         `⚠️ Immediate action required!`;
};

/**
 * Format staff allocation message
 */
exports.formatAllocationMessage = (staffName, counterId, reason) => {
  return `📋 *Staff Assignment*\n\n` +
         `Hello ${staffName},\n\n` +
         `Please report to Counter ${counterId}\n` +
         `Reason: ${reason}\n\n` +
         `Thank you for your cooperation!`;
};

/**
 * Format peak rush warning
 */
exports.formatPeakWarning = (minutesAhead, requiredStaff) => {
  return `⚠️ *Peak Rush Warning*\n\n` +
         `Peak rush expected in ${minutesAhead} minutes\n` +
         `Required Staff: ${requiredStaff}\n\n` +
         `Please prepare and allocate staff accordingly.`;
};

/**
 * Format counter support message
 */
exports.formatSupportMessage = (counterId, queueSize) => {
  return `🆘 *Support Needed*\n\n` +
         `Counter ${counterId} needs support\n` +
         `Current Queue: ${queueSize} people\n\n` +
         `Please send available staff immediately.`;
};
