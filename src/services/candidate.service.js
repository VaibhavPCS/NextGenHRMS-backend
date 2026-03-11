const prisma = require('../config/db');
const { encryptPII, generateBlindIndex } = require('../utils/encryption');

const submitCandidateDetails = async (
    inviteToken, emergencyContact, bloodGroup, cleanAadhar, cleanPan,
    photoUrl, aadharUrl, panUrl, tenthCertUrl, twelfthCertUrl,
    degreeCertUrls, skillCertUrls, passportUrl
) => {

    // 1. Token Verification
    const candidate = await prisma.onboardingCandidate.findFirst({
        where: { inviteToken }
    });

    if (!candidate) {
        const err = new Error("Invalid Invite Token.");
        err.code = 'INVALID_TOKEN';
        throw err;
    }
    if (new Date() >= candidate.tokenExpiry) {
        const err = new Error("Invite Token has expired.");
        err.code = 'TOKEN_EXPIRED';
        throw err;
    }
    if (candidate.onboardingStatus === 'DOCS_UPLOADED') {
        const err = new Error("Documents already submitted.");
        err.code = 'ALREADY_SUBMITTED';
        throw err;
    }

    // 2. Generate Blind Indexes (deterministic hashes for duplicate detection)
    const aadharHash = generateBlindIndex(cleanAadhar);
    const panHash = generateBlindIndex(cleanPan);

    // 3. Duplicate Government ID Check
    // Searches for any other candidate with the same hash — excludes the current candidate
    if (aadharHash || panHash) {
        const existingDuplicate = await prisma.onboardingCandidate.findFirst({
            where: {
                AND: [
                    { id: { not: candidate.id } },
                    {
                        OR: [
                            ...(aadharHash ? [{ aadharHash }] : []),
                            ...(panHash ? [{ panHash }] : []),
                        ]
                    }
                ]
            },
            select: { id: true }
        });

        if (existingDuplicate) {
            const err = new Error("Duplicate government ID detected.");
            err.code = 'DUPLICATE_GOVT_ID';
            throw err;
        }
    }

    // 4. Encrypt PII before storing
    const securedAadhar = encryptPII(cleanAadhar);
    const securedPan = encryptPII(cleanPan);

    // 5. State Transition — clear the token so it cannot be reused
    const updatedCandidate = await prisma.onboardingCandidate.update({
        where: { id: candidate.id },
        data: {
            emergencyContact,
            bloodGroup,

            aadharNumber: securedAadhar,
            aadharHash,
            panNumber: securedPan,
            panHash,

            photoUrl,
            aadharUrl,
            panUrl,
            tenthCertUrl,
            twelfthCertUrl,
            degreeCertUrls,
            skillCertUrls,
            passportUrl,

            onboardingStatus: 'DOCS_UPLOADED',
            inviteToken: null,
            tokenExpiry: null,
        }
    });

    return updatedCandidate;
};

module.exports = { submitCandidateDetails };
