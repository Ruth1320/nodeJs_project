require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const pino = require('pino');

const Log = require('./models/log.model');

const app = express();
const logger = pino();

// Enable CORS and JSON request body parsing.
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4004;
const SERVICE_NAME = process.env.SERVICE_NAME || 'about';



// Save log to Pino
function logToConsole(method, url, endpoint, status, message) {
    logger.info({ method, url, endpoint, status }, message);
}

// Save log to MongoDB
async function saveLogToDatabase(method, url, endpoint, status, message) {
    await Log.create({
        service: SERVICE_NAME,
        method,
        url,
        endpoint,
        status,
        message,
        created_at: new Date()
    });
}

// Main log function
async function saveLog(method, url, endpoint, status, message) {
    try {
        logToConsole(method, url, endpoint, status, message);
        await saveLogToDatabase(method, url, endpoint, status, message);
    } catch (err) {
        logger.error(err.message);
    }
}


// Log every HTTP request after the response is finished.
app.use((req, res, next) => {
    res.on('finish', async () => {
        await saveLog(
            req.method,
            req.originalUrl,
            'request',
            res.statusCode,
            'http request received'
        );
    });

    next();
});



// Retrieve team members from environment variables
function getTeamMembers() {
    return [
        {
            first_name: process.env.TEAM_MEMBER_1_FIRST_NAME,
            last_name: process.env.TEAM_MEMBER_1_LAST_NAME
        },
        {
            first_name: process.env.TEAM_MEMBER_2_FIRST_NAME,
            last_name: process.env.TEAM_MEMBER_2_LAST_NAME
        }
    ];
}

// Return the details of the project team members.
app.get('/api/about', async (req, res) => {
    try {
        await saveLog(req.method, req.originalUrl, '/api/about', 200, 'about endpoint accessed');

        // Team data is loaded from environment variables for flexibility.
        const team = getTeamMembers();

        //sends response
        res.status(200).json(team);
    } catch (error) {
        res.status(500).json({
            id: 'ABOUT_ERROR',
            message: error.message
        });
    }
});

// Handle requests to endpoints that do not exist.
app.use((req, res) => {
    res.status(404).json({
        id: 'NOT_FOUND',
        message: 'endpoint not found'
    });
});

// Connect to MongoDB and start the about service.
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        logger.info('Connected to MongoDB');

        app.listen(PORT, () => {
            logger.info(`${SERVICE_NAME} service is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        logger.error('MongoDB connection failed');
        logger.error(err);
    });