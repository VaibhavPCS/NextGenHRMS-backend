const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hr.controller');

router.post('/invite', hrController.inviteCandidate);

module.exports = router;