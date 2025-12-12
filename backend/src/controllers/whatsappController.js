const whatsappService = require('../services/whatsappService');
const Staff = require('../models/Staff');
const QueueRecord = require('../models/QueueRecord');
const logger = require('../utils/logger');

// POST /whatsapp/alert/rush - Send rush alert
exports.sendRushAlert = async (req, res) => {
  try {
    const { counterId, recipients } = req.body;

    if (!counterId || !recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        success: false,
        error: 'counterId and recipients array are required'
      });
    }

    // Get current queue data
    const queueData = await QueueRecord.findOne({ counterId })
      .sort({ timestamp: -1 });

    if (!queueData) {
      return res.status(404).json({
        success: false,
        error: 'Counter data not found'
      });
    }

    // Format message
    const message = whatsappService.formatRushAlert({
      counterId: queueData.counterId,
      queueSize: queueData.queueSize,
      predictedSize: queueData.predictedSize,
      status: queueData.status
    });

    // Send to all recipients
    const results = await Promise.all(
      recipients.map(phone => whatsappService.sendMessage(phone, message))
    );

    logger.info(`Rush alert sent for counter ${counterId} to ${recipients.length} recipients`);

    res.json({
      success: true,
      counterId,
      recipientCount: recipients.length,
      results,
      message: 'Rush alerts sent successfully'
    });

  } catch (error) {
    logger.error('Error sending rush alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send rush alert'
    });
  }
};

// POST /whatsapp/alert/allocation - Send staff allocation notification
exports.sendAllocationAlert = async (req, res) => {
  try {
    const { allocations } = req.body;

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'allocations array is required'
      });
    }

    const results = [];

    for (const alloc of allocations) {
      const { staffId, counterId, reason } = alloc;

      // Get staff details
      const staff = await Staff.findOne({ staffId });
      
      if (!staff) {
        results.push({
          staffId,
          success: false,
          error: 'Staff not found'
        });
        continue;
      }

      // Format and send message
      const message = whatsappService.formatAllocationMessage(
        staff.name,
        counterId,
        reason || 'Queue load balancing'
      );

      const result = await whatsappService.sendMessage(staff.phone, message);
      
      results.push({
        staffId,
        staffName: staff.name,
        phone: staff.phone,
        ...result
      });
    }

    logger.info(`Allocation alerts sent to ${allocations.length} staff members`);

    res.json({
      success: true,
      count: allocations.length,
      results,
      message: 'Allocation alerts sent'
    });

  } catch (error) {
    logger.error('Error sending allocation alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send allocation alerts'
    });
  }
};

// POST /whatsapp/alert/peak - Send peak rush warning
exports.sendPeakWarning = async (req, res) => {
  try {
    const { minutesAhead, requiredStaff, recipients } = req.body;

    if (!minutesAhead || !requiredStaff || !recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        success: false,
        error: 'minutesAhead, requiredStaff, and recipients are required'
      });
    }

    // Format message
    const message = whatsappService.formatPeakWarning(minutesAhead, requiredStaff);

    // Send to all recipients (managers)
    const results = await Promise.all(
      recipients.map(phone => whatsappService.sendMessage(phone, message))
    );

    logger.info(`Peak warning sent to ${recipients.length} managers`);

    res.json({
      success: true,
      recipientCount: recipients.length,
      results,
      message: 'Peak warnings sent successfully'
    });

  } catch (error) {
    logger.error('Error sending peak warning:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send peak warning'
    });
  }
};

// POST /whatsapp/alert/support - Send support needed alert
exports.sendSupportAlert = async (req, res) => {
  try {
    const { counterId, recipients } = req.body;

    if (!counterId || !recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        success: false,
        error: 'counterId and recipients are required'
      });
    }

    // Get queue data
    const queueData = await QueueRecord.findOne({ counterId })
      .sort({ timestamp: -1 });

    if (!queueData) {
      return res.status(404).json({
        success: false,
        error: 'Counter data not found'
      });
    }

    // Format message
    const message = whatsappService.formatSupportMessage(
      counterId,
      queueData.queueSize
    );

    // Send to recipients
    const results = await Promise.all(
      recipients.map(phone => whatsappService.sendMessage(phone, message))
    );

    logger.info(`Support alert sent for counter ${counterId}`);

    res.json({
      success: true,
      counterId,
      recipientCount: recipients.length,
      results,
      message: 'Support alerts sent successfully'
    });

  } catch (error) {
    logger.error('Error sending support alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send support alert'
    });
  }
};

// POST /whatsapp/send - Send custom message
exports.sendCustomMessage = async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'to and message are required'
      });
    }

    const result = await whatsappService.sendMessage(to, message);

    res.json({
      success: true,
      data: result,
      message: 'Message sent successfully'
    });

  } catch (error) {
    logger.error('Error sending custom message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
};

// POST /whatsapp/broadcast - Broadcast message to all staff
exports.broadcastToStaff = async (req, res) => {
  try {
    const { message, availability } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'message is required'
      });
    }

    // Get staff based on availability filter
    let query = {};
    if (availability) {
      query.availability = availability;
    }

    const staff = await Staff.find(query);

    if (staff.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No staff found'
      });
    }

    // Send to all staff
    const results = await Promise.all(
      staff.map(s => whatsappService.sendMessage(s.phone, message))
    );

    logger.info(`Broadcast sent to ${staff.length} staff members`);

    res.json({
      success: true,
      recipientCount: staff.length,
      results,
      message: 'Broadcast sent successfully'
    });

  } catch (error) {
    logger.error('Error broadcasting message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to broadcast message'
    });
  }
};

// GET /whatsapp/test - Test WhatsApp connection
exports.testConnection = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'phone number is required'
      });
    }

    const result = await whatsappService.sendMessage(
      phone,
      '✅ WhatsApp connection test successful!\n\nAI Queue Load Balancer is ready.'
    );

    res.json({
      success: true,
      data: result,
      message: 'Test message sent'
    });

  } catch (error) {
    logger.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test message'
    });
  }
};
