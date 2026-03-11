const CandidateService = require('../services/candidate.service');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Business logic errors we throw intentionally — logged as WARN, not ERROR
const KNOWN_ERROR_CODES = new Set([
    'DUPLICATE_FILE',
    'DUPLICATE_GOVT_ID',
    'ALREADY_SUBMITTED',
    'INVALID_TOKEN',
    'TOKEN_EXPIRED',
    'INVALID_AADHAR',
    'INVALID_PAN',
]);

const generateFileHash = (filePath) => {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

const submitCandidateDetails = async (req, res) => {
    const allUploadedFiles = [];
    if (req.files) {
        Object.values(req.files).forEach(fileArray => {
            allUploadedFiles.push(...fileArray);
        });
    }

    try {
        const { inviteToken, emergencyContact, bloodGroup, aadharNumber, panNumber } = req.body;
        const maskedToken = inviteToken ? `${inviteToken.substring(0, 8)}***` : 'MISSING_TOKEN';

        logger.info({
            correlationId: req.correlationId,
            maskedToken,
            event: 'SUBMISSION_STARTED',
        }, 'Candidate submission initiated');

        const cleanAadhar = aadharNumber ? aadharNumber.replace(/[\s-]/g, '') : null;
        const cleanPan = panNumber ? panNumber.toUpperCase().trim() : null;

        const aadharRegex = /^[2-9]\d{11}$/;
        const panRegex = /^[A-Z]{5}\d{4}[A-Z]{1}$/;

        if (cleanAadhar && !aadharRegex.test(cleanAadhar)) {
            const err = new Error("Invalid Aadhar Format. Must be exactly 12 digits.");
            err.code = 'INVALID_AADHAR';
            throw err;
        }
        if (cleanPan && !panRegex.test(cleanPan)) {
            const err = new Error("Invalid PAN Format. It must match this format ABCDE1234F.");
            err.code = 'INVALID_PAN';
            throw err;
        }

        const seenHashes = new Set();
        for (const file of allUploadedFiles) {
            const fileHash = generateFileHash(file.path);
            if (seenHashes.has(fileHash)) {
                const err = new Error("Duplicate file detected.");
                err.code = 'DUPLICATE_FILE';
                throw err;
            }
            seenHashes.add(fileHash);
        }

        const profilePhotoUrl = req.files?.profilePhoto?.[0]?.path || null;
        const aadharUrl = req.files?.aadharFile?.[0]?.path || null;
        const panUrl = req.files?.panFile?.[0]?.path || null;
        const tenthUrl = req.files?.tenthMarksheet?.[0]?.path || null;
        const twelfthUrl = req.files?.twelfthMarksheet?.[0]?.path || null;
        const degreeCertUrls = req.files?.collegecertificate?.map(file => file.path) || [];
        const skillCertUrls = req.files?.skilledcertificate?.map(file => file.path) || [];
        const passportUrl = req.files?.passport?.[0]?.path || null;

        const updatedCandidate = await CandidateService.submitCandidateDetails(
            inviteToken, emergencyContact, bloodGroup, cleanAadhar, cleanPan,
            profilePhotoUrl, aadharUrl, panUrl, tenthUrl, twelfthUrl,
            degreeCertUrls, skillCertUrls, passportUrl
        );

        logger.info({
            correlationId: req.correlationId,
            candidateId: updatedCandidate.id,
            event: 'DOCS_UPLOADED',
        }, 'State transition: DOCS_UPLOADED');

        return res.status(200).json({
            status: 'DOCS_UPLOADED',
            message: 'Candidate documents uploaded successfully.',
            candidate: updatedCandidate,
        });

    } catch (error) {
        // Clean up any uploaded files on any failure
        allUploadedFiles.forEach(file => {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });

        const maskedToken = req.body?.inviteToken
            ? `${req.body.inviteToken.substring(0, 8)}***`
            : 'MISSING_TOKEN';

        if (KNOWN_ERROR_CODES.has(error.code)) {
            logger.warn({
                correlationId: req.correlationId,
                maskedToken,
                reason: error.code,
            }, 'Candidate submission rejected');
        } else {
            logger.error({
                correlationId: req.correlationId,
                maskedToken,
                err: error,
            }, 'Candidate submission failed — unexpected error');
        }

        if (error.code === 'DUPLICATE_FILE') {
            return res.status(400).json({
                error: 'Duplicate File Detected: You uploaded the exact same file for multiple different documents.',
                supportCode: req.correlationId,
            });
        }
        if (error.code === 'DUPLICATE_GOVT_ID') {
            return res.status(409).json({
                error: 'Identity Conflict: This Aadhar or PAN number is already registered in our system.',
                supportCode: req.correlationId,
            });
        }
        if (error.code === 'ALREADY_SUBMITTED') {
            return res.status(409).json({
                error: 'Your documents have already been submitted. No further action is required.',
                supportCode: req.correlationId,
            });
        }
        if (error.code === 'INVALID_TOKEN') {
            return res.status(400).json({ error: 'Invalid Invite Token.', supportCode: req.correlationId });
        }
        if (error.code === 'TOKEN_EXPIRED') {
            return res.status(400).json({ error: 'Invite Token has expired.', supportCode: req.correlationId });
        }
        if (error.code === 'INVALID_AADHAR' || error.code === 'INVALID_PAN') {
            return res.status(400).json({ error: error.message, supportCode: req.correlationId });
        }

        // Anything that reaches here is an unexpected server error
        // Never expose raw error.message — it may contain Prisma internals
        return res.status(500).json({ error: 'Internal Server Error', supportCode: req.correlationId });
    }
};

module.exports = { submitCandidateDetails };
