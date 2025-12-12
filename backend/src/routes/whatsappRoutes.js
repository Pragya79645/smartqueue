const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// POST /whatsapp/alert/rush - Send rush alert for high queue
router.post('/alert/rush', whatsappController.sendRushAlert);

// POST /whatsapp/alert/allocation - Send staff allocation notifications
router.post('/alert/allocation', whatsappController.sendAllocationAlert);

// POST /whatsapp/alert/peak - Send peak rush warning
router.post('/alert/peak', whatsappController.sendPeakWarning);

// POST /whatsapp/alert/support - Send support needed alert
router.post('/alert/support', whatsappController.sendSupportAlert);

// POST /whatsapp/send - Send custom message
router.post('/send', whatsappController.sendCustomMessage);

// POST /whatsapp/broadcast - Broadcast message to all staff
router.post('/broadcast', whatsappController.broadcastToStaff);

// GET /whatsapp/test - Test WhatsApp connection
router.get('/test', whatsappController.testConnection);

module.exports = router;
