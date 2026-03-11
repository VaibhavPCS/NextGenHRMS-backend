const prisma = require('../config/db');
const crypto = require('crypto');

// All statuses that mean the candidate/employee is beyond the initial invite stage
// Attempting to re-invite any of these is blocked
const TERMINAL_STATUSES = new Set([
    'DOCS_UPLOADED',
    'OFFER_ROLLED',
    'OFFER_ACCEPTED',
    'RESIGNATION_VERIFIED',
    'BGV_CLEARED',
    'BANK_DETAILS_SUBMITTED',
    'ACTIVE',
    'REJECTED',
]);

const stageCandidate = async (personalEmail, firstName, lastName, phoneNumber) => {
    const generatedToken = crypto.randomBytes(32).toString('hex');

    // Fallback to 72h if env var is missing — parseInt(undefined) = NaN which makes an Invalid Date
    const expiryHours = parseInt(process.env.INVITE_EXPIRY_HOURS) || 72;
    const expiryTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // Only fetch the fields we need for the status check — not the full document with encrypted PII
    const existing = await prisma.onboardingCandidate.findFirst({
        where: {
            OR: [
                { personalEmail },
                { phoneNumber }
            ]
        },
        select: {
            id: true,
            onboardingStatus: true,
            tokenExpiry: true,
        }
    });

    if (existing) {
        // Case 1: Candidate is meaningfully progressed — block completely
        if (TERMINAL_STATUSES.has(existing.onboardingStatus)) {
            const err = new Error('This candidate has already completed onboarding.');
            err.code = 'CANDIDATE_ALREADY_ONBOARDED';
            throw err;
        }

        // Case 2: Active invite still exists (token not yet expired) — block duplicate send
        if (existing.tokenExpiry && new Date() < existing.tokenExpiry) {
            const err = new Error('An active invite already exists for this candidate. Wait for it to expire before re-inviting.');
            err.code = 'ACTIVE_INVITE_EXISTS';
            throw err;
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
