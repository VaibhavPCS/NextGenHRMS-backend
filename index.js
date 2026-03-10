require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { middleware, errorHandler } = require('supertokens-node/framework/express');
const { initializeSupertokens } = require('./src/config/supertokens.config');
const hrRoutes = require('./src/routes/hr.routes');
const candidateRoutes = require('./src/routes/candidate.routes');
initializeSupertokens();
const app = express();
const PORT = process.env.PORT;
app.use(cors({
    origin: process.env.FRONTEND_URL,
    allowedHeaders: ["content-type", ...require('supertokens-node').getAllCORSHeaders()],
    credentials: true,
}));
app.use(express.json());
app.use(middleware());
app.get('/api/health', (req, res) => {
    res.send({ status: 'NextGenHRMS Engine is Online' });
});
app.use('/api/hr', hrRoutes);
app.use('/api/candidate', candidateRoutes);
app.use(errorHandler());
app.listen(PORT, () => {
    console.log(`✅ NextGenHRMS Backend strictly running on port ${PORT}`);
});