const { getEmployeeProfile } = require('../services/employee.service');
const logger = require('../utils/logger');

// Naming convention: function name matches the route action — "getMe" mirrors "GET /me"
const getMe = async (req, res) => {
    const supertokensId = req.session.getUserId();

    try {
        const profile = await getEmployeeProfile(supertokensId);

        logger.info({
            correlationId: req.correlationId,
            employeeId: profile.id,
            event: 'PROFILE_FETCHED',
        }, 'Employee profile retrieved successfully');

        res.status(200).json(profile);

    } catch (error) {
        if (error.code === 'EMPLOYEE_NOT_FOUND') {
            logger.warn({
                correlationId: req.correlationId,
                event: 'PROFILE_FETCH_REJECTED',
                reason: 'EMPLOYEE_NOT_FOUND',
            }, 'No employee record found for this session');
            return res.status(404).json({ message: error.message });
        }

        if (error.code === 'ACCESS_REVOKED') {
            logger.warn({
                correlationId: req.correlationId,
                event: 'PROFILE_FETCH_REJECTED',
                reason: 'ACCESS_REVOKED',
            }, 'Revoked employee attempted to fetch profile');
            return res.status(403).json({ message: error.message });
        }

        logger.error({
            correlationId: req.correlationId,
            event: 'PROFILE_FETCH_ERROR',
            err: error,
        }, 'Unexpected error fetching employee profile');

        res.status(500).json({ message: "Failed to retrieve employee profile" });
    }
};

module.exports = { getMe };
