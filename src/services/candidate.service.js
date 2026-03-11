const prisma = require('../config/db');
const { encryptPII, generateBlindIndex } = require('../utils/encryption');

const submitCandidateDetails = async (
    inviteToken, emergencyContact, bloodGroup, cleanAadhar, cleanPan,
    photoUrl, aadharUrl, panUrl, tenthCertUrl, twelfthCertUrl, 
    degreeCertUrls, skillCertUrls, passportUrl
) => {

    // 1. The Token Verification
    const candidate = await prisma.onboardingCandidate.findFirst({
        where: { inviteToken: inviteToken }
    });
    if (!candidate) throw new Error("Invalid Invite Token.");
    if (new Date() >= candidate.tokenExpiry) throw new Error("Token Expired.");

    // 2. Generate the Blind Indexes (Hashes)
    const aadharHash = generateBlindIndex(cleanAadhar);
    const panHash = generateBlindIndex(cleanPan);

    // 3. The Duplicate Government ID Check
    // We search the database to see if ANY other candidate possesses these exact hashes
    if (aadharHash || panHash) {
        const existingDuplicate = await prisma.onboardingCandidate.findFirst({
            where: {
                OR: [
                    { aadharHash: aadharHash },
                    { panHash: panHash }
                ]
            }
        });

        if (existingDuplicate) {
            throw new Error("DUPLICATE_GOVT_ID"); // The controller will catch this!
        }
    }

    // 4. The Vault: Encrypt the data for safe storage
    const securedAadhar = encryptPII(cleanAadhar);
    const securedPan = encryptPII(cleanPan);

    // 5. The State Transition
    const updatedCandidate = await prisma.onboardingCandidate.update({
        where: { id: candidate.id },
        data: {
            emergencyContact,
            bloodGroup,
            
            // Save BOTH the encrypted strings AND the searchable hashes
            aadharNumber: securedAadhar,
            aadharHash: aadharHash,
            panNumber: securedPan,
            panHash: panHash,
            
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