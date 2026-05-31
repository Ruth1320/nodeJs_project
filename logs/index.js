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

const port = process.env.PORT || 4001;
const serviceName = process.env.SERVICE_NAME || 'logs';


// Save log to Pino
function logToConsole(method, url, endpoint, status, message) {
    logger.info({method, url, endpoint, status}, message);
}

// Save log to MongoDB
async function saveLogToDatabase(method, url, endpoint, status, message) {
    await Log.create({
        service: serviceName,
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

// Middleware that saves a log for every HTTP request received by this service.
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

async function getAllLogs() {
    return await Log.find({}, {__v: 0}).sort({created_at: -1});
}

// Endpoint for returning all logs stored in the logs collection.
app.get('/api/logs', async (req, res) => {
    try {
        await saveLog(
            req.method,
            req.originalUrl,
            '/api/logs',
            200,
            'logs endpoint accessed'
        );

        // Return the logs sorted from newest to oldest and hide the internal __v field.
        const logs = await getAllLogs();
        res.status(200).json(logs);

    } catch (error) {
        res.status(500).json({
            id: 'LOGS_ERROR',
            message: error.message
        });
    }
});

// Handle requests to routes that do not exist in this service.
app.use((req, res) => {
    res.status(404).json({
        id: 'NOT_FOUND',
        message: 'endpoint not found'
    });
});

// Connect to MongoDB Atlas and start the logs service.
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(port, () => {
            logger.info(`logs service is running on port ${port}`);
        });
    })
    .catch((error) => {
        logger.error(error);
    });