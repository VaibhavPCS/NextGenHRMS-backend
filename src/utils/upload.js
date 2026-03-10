const multer = require('multer');
const fs = require('fs');

const uploadDir = process.env.UPLOADS_FOLDER || './uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const cleanName = file.originalname.replace(/\s+/g, '_');
        cb(null, Date.now() + "-" + cleanName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = process.env.ALLOWED_FILE_TYPES.split(',');

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false); 
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: process.env.FILE_SIZE_LIMIT * 1024 * 1024 } 
});

module.exports = upload;