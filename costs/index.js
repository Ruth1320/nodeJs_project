require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const pino = require('pino');
const Cost = require('./models/cost.model');
const User = require('./models/user.model');
const Log = require('./models/log.model');
const MonthlyReport = require('./models/monthlyReport.model');

const app = express();
const logger = pino();

// Enable CORS and JSON request body parsing.
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 4003;
const serviceName = process.env.SERVICE_NAME || 'costs';

// The allowed cost categories according to the project requirements.
const categories = ['food', 'health', 'housing', 'sports', 'education'];

/*
 Saves log messages with Pino and also stores them in MongoDB.
 This allows all services to keep their logs in one shared logs collection.
*/
async function saveLog(method, url, endpoint, status, message) {
    try {
        logger.info({ method, url, endpoint, status }, message);

        await Log.create({
            service: serviceName,
            method,
            url,
            endpoint,
            status,
            message
        });
    } catch (error) {
        logger.error(error);
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

// Check if the requested month is already in the past.
function isMonthInPast(year, month) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    return year < currentYear || (year === currentYear && month < currentMonth);
}

// Build an empty monthly report with all required categories.
function buildEmptyReport(userId, year, month) {
    return {
        userid: userId,
        year,
        month,
        costs: categories.map((category) => ({
            [category]: []
        }))
    };
}

// Add one cost document into the correct category inside the report.
function addCostToReport(report, cost) {
    const categoryObject = report.costs.find((item) => {
        return Object.prototype.hasOwnProperty.call(item, cost.category);
    });

    if (categoryObject) {
        categoryObject[cost.category].push({
            sum: Number(cost.sum),
            description: cost.description,
            day: cost.created_at.getDate()
        });
    }
}

/*
 This function implements the computed design pattern.
 Reports for old months are saved in MongoDB and reused in future requests.
 If a saved report exists, it is returned directly.
 If not, the report is calculated from the costs collection and then saved.
*/
async function getMonthlyReport(userId, year, month) {
    if (isMonthInPast(year, month)) {
        const savedReport = await MonthlyReport.findOne(
            { userid: userId, year, month },
            { _id: 0, __v: 0, created_at: 0 }
        );

        if (savedReport) {
            return savedReport.toObject();
        }
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const report = buildEmptyReport(userId, year, month);

    // Get all costs of the user in the requested month.
    const costs = await Cost.find({
        userid: userId,
        created_at: {
            $gte: startDate,
            $lt: endDate
        }
    }).sort({ created_at: 1 });

    // Insert every cost into its matching category in the report.
    costs.forEach((cost) => {
        addCostToReport(report, cost);
    });

    // Save old monthly reports so they will not need to be calculated again.
    if (isMonthInPast(year, month)) {
        await MonthlyReport.findOneAndUpdate(
            { userid: userId, year, month },
            report,
            { upsert: true, new: true }
        );
    }

    return report;
}

// Validates request and creates a new cost for an existing user in the database.
app.post('/api/add', async (req, res) => {
    try {
        await saveLog(req.method, req.originalUrl, '/api/add', 200, 'add cost endpoint accessed');

        const { description, category, userid, sum, created_at } = req.body;

        // Validate required cost fields.
        if (!description || !category || userid === undefined || sum === undefined) {
            return res.status(400).json({
                id: 'MISSING_COST_DATA',
                message: 'description, category, userid and sum are required'
            });
        }

        // Validate that the category is one of the allowed categories.
        if (!categories.includes(category)) {
            return res.status(400).json({
                id: 'INVALID_CATEGORY',
                message: 'category must be food, health, housing, sports or education'
            });
        }

        const numericUserId = Number(userid);
        const numericSum = Number(sum);

        // Validate that the userid is numeric.
        if (!Number.isFinite(numericUserId)) {
            return res.status(400).json({
                id: 'INVALID_USER_ID',
                message: 'userid must be a number'
            });
        }

        // Validate that the sum is a valid non-negative number.
        if (!Number.isFinite(numericSum) || numericSum < 0) {
            return res.status(400).json({
                id: 'INVALID_SUM',
                message: 'sum must be a positive number'
            });
        }

        // Costs can only be added for users that already exist.
        const user = await User.findOne({ id: numericUserId });

        if (!user) {
            return res.status(404).json({
                id: 'USER_NOT_FOUND',
                message: 'user not found'
            });
        }


        let costDate = new Date();

        // Optional created_at support, mainly used for testing and validation.
        if (created_at) {
            costDate = new Date(created_at);
            if (Number.isNaN(costDate.getTime())) {
                return res.status(400).json({
                    id: 'INVALID_DATE',
                    message: 'created_at must be a valid date'
                });
            }

            // Validate that the cost date is not in the past.
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            if (costDate < todayStart) {
                return res.status(400).json({
                    id: 'PAST_DATE_NOT_ALLOWED',
                    message: 'costs with past dates are not allowed'
                });
            }
        }

        // Create the cost in MongoDB.
        const cost = await Cost.create({
            description,
            category,
            userid: numericUserId,
            sum: numericSum,
            created_at: costDate
        });

        // Return created cost
        res.status(201).json({
            description: cost.description,
            category: cost.category,
            userid: cost.userid,
            sum: Number(cost.sum),
            created_at: cost.created_at
        });
    } catch (error) {
        res.status(500).json({
            id: 'ADD_COST_ERROR',
            message: error.message
        });
    }
});

// Return a monthly report for a specific user, year and month.
app.get('/api/report', async (req, res) => {
    try {
        await saveLog(req.method, req.originalUrl, '/api/report', 200, 'report endpoint accessed');

        const userId = Number(req.query.id);
        const year = Number(req.query.year);
        const month = Number(req.query.month);

        // Validate report query parameters.
        if (!Number.isFinite(userId) || !Number.isFinite(year) || !Number.isFinite(month)) {
            return res.status(400).json({
                id: 'INVALID_REPORT_PARAMS',
                message: 'id, year and month must be numbers'
            });
        }

        // Validate month range.
        if (month < 1 || month > 12) {
            return res.status(400).json({
                id: 'INVALID_MONTH',
                message: 'month must be between 1 and 12'
            });
        }

        // Ensure user exists before generating report
        const user = await User.findOne({ id: userId });

        if (!user) {
            return res.status(404).json({
                id: 'USER_NOT_FOUND',
                message: 'user not found'
            });
        }

        // Generate or retrieve monthly report (cached or computed).
        const report = await getMonthlyReport(userId, year, month);

        res.status(200).json(report);
    } catch (error) {
        res.status(500).json({
            id: 'REPORT_ERROR',
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

// Connect to MongoDB and start the costs service.
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(port, () => {
            logger.info(`costs service is running on port ${port}`);
        });
    })
    .catch((error) => {
        logger.error(error);
    });