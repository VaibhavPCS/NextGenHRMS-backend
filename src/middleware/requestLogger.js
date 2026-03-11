'use strict';
const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const responseTimeMs = Date.now() - startTime;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        logger[level]({
            correlationId: req.correlationId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTimeMs,
            ip: req.ip,
        }, `HTTP ${req.method} ${req.url} ${res.statusCode} ${responseTimeMs}ms`);
    });

    next();
};

module.exports = requestLogger;
