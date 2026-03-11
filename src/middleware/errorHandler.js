'use strict';
const logger = require('../utils/logger');

// 4-parameter signature is required by Express to recognise this as an error handler
// eslint-disable-next-line no-unused-vars
const globalErrorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    logger.error({
        correlationId: req.correlationId,
        err,
        method: req.method,
        url: req.url,
        statusCode,
    }, 'Unhandled server exception');

    return res.status(statusCode).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message,
        supportCode: req.correlationId,
    });
};

module.exports = globalErrorHandler;
