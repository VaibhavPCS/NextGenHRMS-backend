const prisma = require('../config/db');
const crypto = require('crypto');

const stageCandidate = async (personalEmail, firstName, lastName, phoneNumber) => {
    const generatedToken = crypto.randomBytes(32).toString('hex');
    const expiryHours = parseInt(process.env.INVITE_EXPIRY_HOURS);
    const expiryTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // Check if this email OR phone already exists in the system
    const existing = await prisma.onboardingCandidate.findFirst({
        where: {
            OR: [
                { personalEmail },
                { phoneNumber }
            ]
        }
    });

    if (existing) {
        // Case 1: Already completed onboarding — block completely
        if (existing.onboardingStatus === 'DOCS_UPLOADED') {
            throw new Error('CANDIDATE_ALREADY_ONBOARDED');
        }

        // Case 2: Active invite still exists (token not yet expired) — block duplicate send
        if (existing.tokenExpiry && new Date() < existing.tokenExpiry) {
            throw new Error('ACTIVE_INVITE_EXISTS');
        }

        // Case 3: Token expired — re-invite by refreshing the token
        await prisma.onboardingCandidate.update({
            where: { id: existing.id },
            data: {
                firstName,
                lastName,
                inviteToken: generatedToken,
                tokenExpiry: expiryTime,
            }
        });
        return { token: generatedToken, candidateId: existing.id };
    }

    // Case 4: Brand new candidate
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

    return { token: generatedToken, candidateId: newCandidate.id };
};

module.exports = { stageCandidate };
