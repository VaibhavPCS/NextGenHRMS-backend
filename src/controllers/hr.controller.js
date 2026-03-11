const hrService = require('../services/hr.service');
const logger = require('../utils/logger');

const inviteCandidate = async (req, res) => {
    try {
        const { personalEmail, firstName, lastName, phoneNumber } = req.body;

        if (!personalEmail || !phoneNumber) {
            logger.warn({
                correlationId: req.correlationId,
                reason: 'MISSING_REQUIRED_FIELDS',
            }, 'Invite validation failed');
            return res.status(400).json({ error: 'Email and Phone Number are strictly required.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+91[6-9]\d{9}$/;

        if (!phoneRegex.test(phoneNumber)) {
            logger.warn({
                correlationId: req.correlationId,
                reason: 'INVALID_PHONE_FORMAT',
            }, 'Invite validation failed');
            return res.status(400).json({
                error: 'Invalid Phone Format. Must be a valid 10-digit Indian mobile number starting with +91.',
            });
        }

        if (!emailRegex.test(personalEmail)) {
            logger.warn({
                correlationId: req.correlationId,
                reason: 'INVALID_EMAIL_FORMAT',
            }, 'Invite validation failed');
            return res.status(400).json({ error: 'Invalid Email Format.' });
        }

        const extractedDomain = personalEmail.split('@')[1].toLowerCase();
        const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS.split(',');

        if (!allowedDomains.includes(extractedDomain)) {
            logger.warn({
                correlationId: req.correlationId,
                reason: 'BLOCKED_EMAIL_DOMAIN',
                domain: extractedDomain,
            }, 'Invite validation failed');
            return res.status(403).json({ error: 'Invalid Email. Use a verified domain.' });
        }

        const { token, candidateId } = await hrService.stageCandidate(personalEmail, firstName, lastName, phoneNumber);
        const magicLink = `${process.env.FRONTEND_URL}/onboard?token=${token}`;

        logger.info({
            correlationId: req.correlationId,
            candidateId,
            event: 'INVITE_SENT',
        }, 'State transition: INVITE_SENT');

        return res.status(200).json({
            status: 'INVITE_SENT',
            message: 'Candidate invited successfully.',
            link: magicLink,
        });

    } catch (error) {
        // Use error.code — not error.message — for robust error type matching
        if (error.code === 'CANDIDATE_ALREADY_ONBOARDED') {
            logger.warn({
                correlationId: req.correlationId,
                reason: error.code,
            }, 'Invite rejected — candidate already onboarded');
            return res.status(409).json({
                error: error.message,
                supportCode: req.correlationId,
            });
        }

        if (error.code === 'ACTIVE_INVITE_EXISTS') {
            logger.warn({
                correlationId: req.correlationId,
                reason: error.code,
            }, 'Invite rejected — active invite already exists');
            return res.status(409).json({
                error: error.message,
                supportCode: req.correlationId,
            });
        }

        logger.error({
            correlationId: req.correlationId,
            err: error,
        }, 'Invite generation failed — unexpected error');

        return res.status(500).json({ error: 'Internal Server Error', supportCode: req.correlationId });
    }
};

module.exports = { inviteCandidate };
