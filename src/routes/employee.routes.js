const express = require('express');
const { verifySession } = require('supertokens-node/recipe/session/framework/express');
const employeeController = require('../controllers/employee.controller');

const router = express.Router();

router.get('/me', verifySession(), employeeController.getMe);

module.exports = router;