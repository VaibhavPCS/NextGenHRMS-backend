const CandidateService = require('../services/candidate.service');
const fs = require('fs');
const crypto = require('crypto');

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
        const cleanAadhar = aadharNumber ? aadharNumber.replace(/[\s-]/g, '') : null;
        const cleanPan = panNumber ? panNumber.toUpperCase().trim() : null;

        const aadharRegex = /^[2-9]\d{11}$/;
        const panRegex = /^[A-Z]{5}\d{4}[A-Z]{1}$/;

        if (cleanAadhar && !aadharRegex.test(cleanAadhar)) {
            throw new Error("Invalid Aadhar Format. Must be exactly 12 digits.");
        }
        if (cleanPan && !panRegex.test(cleanPan)) {
            throw new Error("Invalid PAN Format. It must match this format ABCDE1234F.");
        }

        const seenHashes = new Set();
        for (const file of allUploadedFiles) {
            const fileHash = generateFileHash(file.path);
            
            if (seenHashes.has(fileHash)) {
                throw new Error("DUPLICATE_FILE"); 
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

        return res.status(200).json({
            status: "DOCS_UPLOADED",
            message: "Candidate documents uploaded successfully.",
            candidate: updatedCandidate
        });

    } catch (error) {
        allUploadedFiles.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });

        console.error("Error in Candidate Submission:", error.message);

        if (error.message === "DUPLICATE_FILE") {
            return res.status(400).json({ 
                error: "Duplicate File Detected: You uploaded the exact same file for multiple different documents." 
            });
        }
        
        if (error.message === "DUPLICATE_GOVT_ID") {
            return res.status(409).json({ 
                error: "Identity Conflict: This Aadhar or PAN number is already registered in our system." 
            });
        }

        return res.status(400).json({ error: error.message });
    }
};

module.exports = { submitCandidateDetails };