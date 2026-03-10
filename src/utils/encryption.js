const crypto = require('crypto');

const ALGORITHM = process.env.ALGORITHM;
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); 

const encryptPII = (text) => {
    if (!text) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

const decryptPII = (encryptedData) => {
    if (!encryptedData) return null;
    
    try {
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = Buffer.from(parts[2], 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error("CRITICAL: PII Decryption/Tamper Failure!");
        return "DATA_CORRUPTED_OR_TAMPERED";
    }
};

const generateBlindIndex = (text) => {
    if (!text) return null;
    return crypto.createHmac('sha256', ENCRYPTION_KEY).update(text).digest('hex');
};

module.exports = { encryptPII, decryptPII, generateBlindIndex };