require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { middleware, errorHandler } = require('supertokens-node/framework/express');
const { initializeSupertokens } = require('./src/config/supertokens.config');
const hrRoutes = require('./src/routes/hr.routes');
const candidateRoutes = require('./src/routes/candidate.routes');
const logger = require('./src/utils/logger');
const traceMiddleware = require('./src/middleware/trace');
const requestLogger = require('./src/middleware/requestLogger');
const globalErrorHandler = require('./src/middleware/errorHandler');
const authRoutes = require('./src/routes/auth.routes');
const employeeRoutes = require('./src/routes/employee.routes');
const prisma = require('./src/config/db');

initializeSupertokens();

const app = express();
const PORT = process.env.PORT;

app.use(cors({
    origin: process.env.FRONTEND_URL,
    allowedHeaders: ['content-type', ...require('supertokens-node').getAllCORSHeaders()],
    credentials: true,
}));

app.use(express.json());
app.use(traceMiddleware);   // Attach a unique correlationId to every request
app.use(requestLogger);     // Log every HTTP request with method, url, status, response time

app.use(middleware());

app.get('/api/health', (req, res) => {
    res.send({ status: 'NextGenHRMS Engine is Online' });
});

app.use('/api/hr', hrRoutes);
app.use('/api/candidate', candidateRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employee', employeeRoutes);

app.use(errorHandler());        // SuperTokens error handler
app.use(globalErrorHandler);    // Global fallback for any unhandled exception

// Hold a reference to the server so we can close it cleanly on shutdown
const server = app.listen(PORT, () => {
    logger.info({ event: 'SERVER_START', port: PORT }, `NextGenHRMS Backend running on port ${PORT}`);
});

// Graceful shutdown — critical for Docker/Kubernetes
// SIGTERM: sent by K8s/Docker before stopping the container
// SIGINT: sent when you press Ctrl+C locally
const shutdown = async (signal) => {
    logger.info({ event: 'SHUTDOWN_INITIATED', signal }, 'Graceful shutdown started');

    server.close(async () => {
        await prisma.$disconnect();
        logger.info({ event: 'SHUTDOWN_COMPLETE' }, 'HTTP server closed, Prisma disconnected');
        process.exit(0);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
