const hrService = require('../services/hr.service');

const inviteCandidate = async (req, res) => {
    try {
        const { personalEmail, firstName, lastName, phoneNumber } = req.body;
        if (!personalEmail || !phoneNumber) {
            return res.status(400).json({ error: "Email and Phone Number are strictly required." });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+91[6-9]\d{9}$/;

        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({
                error: "Invalid Phone Format. Must be a valid 10-digit Indian mobile number starting with +91."
            });
        }

        if (!emailRegex.test(personalEmail)) {
            return res.status(400).json({ error: "Invalid Email Format." });
        }
        const extractedDomain = personalEmail.split('@')[1].toLowerCase();
        const allowedDomainsString = process.env.ALLOWED_EMAIL_DOMAINS;
        const allowedDomains = allowedDomainsString.split(',');

        if (!allowedDomains.includes(extractedDomain)) {
            return res.status(403).json({
                error: `Invalid Email. Use a verified domain.`
            });
        }
        const token = await hrService.stageCandidate(personalEmail, firstName, lastName, phoneNumber);
        const magicLink = `${process.env.FRONTEND_URL}/onboard?token=${token}`;
        return res.status(200).json({
            status: "INVITE_SENT",
            message: "Candidate invited successfully.",
            link: magicLink
        });
    } catch (error) {
        console.error("Error generating invite:", error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: "Candidate with this Email or Phone already exists." });
        }
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = { inviteCandidate };