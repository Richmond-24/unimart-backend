const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// POST /api/webhooks/external-listing
router.post('/external-listing', webhookController.externalListingCreate);

module.exports = router;
