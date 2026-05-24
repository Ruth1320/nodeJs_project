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

/*
 This service is responsible for the logs process.
 It exposes an endpoint for getting all logs from MongoDB.
 In addition, it writes a log document for every HTTP request and for every endpoint access.
*/
async function saveLog(method, url, endpoint, status, message) {
    try {
        // Print the log message using Pino.
        logger.info({ method, url, endpoint, status }, message);

        // Save the log message in MongoDB.
        await Log.create({
            service: serviceName,
            method,
            url,
            endpoint,
            status,
            message
        });
    } catch (error) {
        // Logging errors should not crash the service.
        logger.error(error);
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
        const logs = await Log.find({}, { __v: 0 }).sort({ created_at: -1 });

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