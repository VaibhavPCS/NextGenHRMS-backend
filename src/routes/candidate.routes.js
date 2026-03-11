const express = require('express');
const CandidateController = require('../controllers/candidate.controller');
const router = express.Router();
const upload = require('../utils/upload');
const multer = require('multer');

const multerFields = upload.fields([
    { name: 'aadharFile', maxCount: 1 },
    { name: 'panFile', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'tenthMarksheet', maxCount: 1 },
    { name: 'twelfthMarksheet', maxCount: 1 },
    { name: 'collegecertificate', maxCount: 5 },
    { name: 'skilledcertificate', maxCount: 5 },
    { name : 'passport', maxCount: 1 }
]);

const uploadMiddleware = (req, res, next) => {
    multerFields(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ 
                    error: `Upload Limit Exceeded: You uploaded too many files for the '${err.field}' field. Only 1 file is allowed per document.` 
                });
            }
            
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ 
                    error: `File Size Error: The document you uploaded is too large. Maximum allowed size is 5MB.` 
                });
            }

            return res.status(400).json({ error: `File Upload Error: ${err.message}` });
            
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

router.post('/submit-details', uploadMiddleware, CandidateController.submitCandidateDetails);

module.exports = router;