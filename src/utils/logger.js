'use strict';
const pino = require('pino');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

// 1. The Machine Transport (Pure JSON for Promtail/Loki)
const targets = [
    {
        target: 'pino-roll',
        options: {
            file: path.join(__dirname, '../../logs/combined'),
            extension: '.log',
            size: '10m',        // Rotate when file hits 10MB
            frequency: 'daily', // Or at midnight, whichever comes first
            mkdir: true
        },
        level: 'info'
    },
    // Separate error-only rotation — support team checks this first
    {
        target: 'pino-roll',
        options: {
            file: path.join(__dirname, '../../logs/error'),
            extension: '.log',
            size: '10m',
            frequency: 'daily',
            mkdir: true
        },
        level: 'error'
    }
];

// 2. The Human Transport (Pretty terminal output for you)
if (isDev) {
    targets.push({
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname'
        }
    });
}

const logger = pino({
    redact: {
        paths: [
            'body.aadharNumber',
            'body.panNumber',
            'body.password',
            'body.inviteToken',
            'req.headers.authorization'
        ],
        censor: '[REDACTED-PII]'
    },
    transport: {
        targets: targets
    }
});

module.exports = logger;
