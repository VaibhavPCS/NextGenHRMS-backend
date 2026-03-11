const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifySession } = require('supertokens-node/recipe/session/framework/express');

router.post('/link', verifySession(), authController.linkUserToEmployeeController);

module.exports = router;