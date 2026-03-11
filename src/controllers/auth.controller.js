const { linkUserToEmployee } = require('../services/auth.service');
const logger = require('../utils/logger');

const linkUserToEmployeeController = async (req, res) => {
    const supertokensId = req.session.getUserId();

    try {
        const updatedEmployee = await linkUserToEmployee(supertokensId);

        logger.info({
            correlationId: req.correlationId,
            employeeId: updatedEmployee.id,
            event: 'SESSION_LINKED',
        }, 'Employee session linked successfully');

        res.status(200).json({ message: "User linked to employee successfully", employee: updatedEmployee });

    } catch (error) {
        if (error.code === 'NOT_ONBOARDED') {
            logger.warn({
                correlationId: req.correlationId,
                event: 'LOGIN_REJECTED',
                reason: 'NOT_ONBOARDED',
            }, 'Login rejected — phone number not in employee table, session revoked');

            try { await req.session.revokeSession(); } catch (revokeErr) {}
            return res.status(403).json({ message: error.message });
        }

        if (error.code === 'ACCESS_REVOKED') {
            logger.warn({
                correlationId: req.correlationId,
                event: 'LOGIN_REJECTED',
                reason: 'ACCESS_REVOKED',
            }, 'Login rejected — terminated employee attempted access, session destroyed');

            try { await req.session.revokeSession(); } catch (revokeErr) {}
            return res.status(403).json({ message: error.message });
        }

        logger.error({
            correlationId: req.correlationId,
            event: 'LINK_SESSION_ERROR',
            err: error,
        }, 'Unexpected error during session link');

        res.status(500).json({ message: "Failed to link user to employee" });
    }
};

module.exports = { linkUserToEmployeeController };
