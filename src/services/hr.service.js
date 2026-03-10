const prisma = require('../config/db');
const crypto = require('crypto');

const stageCandidate = async (personalEmail, firstName, lastName, phoneNumber) => {
    const generatedToken = crypto.randomBytes(32).toString('hex'); 
    const expiryHours = parseInt(process.env.INVITE_EXPIRY_HOURS);
    const expiryTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000); 
    const newCandidate = await prisma.onboardingCandidate.create({
        data: {
            personalEmail,
            firstName,
            lastName,
            phoneNumber,
            inviteToken: generatedToken,
            tokenExpiry: expiryTime,
        },
    });
    return generatedToken;
};

module.exports = { stageCandidate };