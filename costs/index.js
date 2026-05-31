require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const pino = require('pino');
const Cost = require('./models/cost.model');
const User = require('./models/user.model');
const Log = require('./models/log.model');
const MonthlyReport = require('./models/monthly_report.model');

const app = express();
const logger = pino();

// Enable CORS and JSON request body parsing.
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 4003;
const serviceName = process.env.SERVICE_NAME || 'costs';

// The allowed cost categories according to the project requirements.
const categories = ['food', 'health', 'housing', 'sports', 'education'];

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
function buildEmptyReport(userid, year, month) {
    return {
        userid: userid,
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

// Try to retrieve a previously saved monthly report from MongoDB.
async function getSavedMonthlyReport(userid, year, month) {
    const savedReport = await MonthlyReport.findOne(
        {userid: userid, year, month},
        {_id: 0, __v: 0, created_at: 0}
    );

    if (savedReport) {
        return savedReport.toObject();
    }

    return null;
}

// Calculate a new monthly report from the costs collection.
async function calculateMonthlyReport(userid, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const report = buildEmptyReport(userid, year, month);


    // Get all costs of the user in the requested month.
    const costs = await Cost.find({
        userid: userid,
        created_at: {
            $gte: startDate,
            $lt: endDate
        }
    }).sort({created_at: 1});

    // Insert every cost into its matching category in the report.
    costs.forEach((cost) => {
        addCostToReport(report, cost);
    });

    return report;
}

// Save old monthly reports so they will not need to be calculated again.
async function saveMonthlyReport(userid, year, month, report) {
    await MonthlyReport.findOneAndUpdate(
        {userid: userid, year, month},
        report,
        {upsert: true, new: true}
    );
}

/*
 This function implements the computed design pattern.
 Reports for old months are saved in MongoDB and reused in future requests.
 If a saved report exists, it is returned directly.
 If not, the report is calculated from the costs collection and then saved.
*/
async function getMonthlyReport(userid, year, month) {
    if (isMonthInPast(year, month)) {
        const savedReport = await getSavedMonthlyReport(
            userid,
            year,
            month
        );

        if (savedReport) {
            return savedReport;
        }
    }
    // Calculate a new monthly report.
    const report = await calculateMonthlyReport(
        userid,
        year,
        month
    );

    // Save old reports for future reuse.
    if (isMonthInPast(year, month)) {
        await saveMonthlyReport(
            userid,
            year,
            month,
            report
        );
    }

    return report;
}


function normalizeReport(report) {
    return {
        userid: report.userid,
        year: report.year,
        month: report.month,
        costs: report.costs
    };
}



//validate all cost input fields
function validateCostInput(description, category, userid, sum, created_at) {

    // Validate required cost fields.
    if (
        description === undefined || category === undefined || userid === undefined || sum === undefined) {
        return {
            error: {
                status: 400,
                id: 'MISSING_COST_DATA',
                message: 'description, category, userid and sum are required'
            }
        };
    }

// Validate description type.
    if (typeof description !== 'string') {
        return {
            error: {
                status: 400,
                id: 'INVALID_DESCRIPTION',
                message: 'description must be a string'
            }
        };
    }


    //disables the option to enter huge description
    const truncatedDescription = description.slice(0, 200);


    // Validate category type.
    if (typeof category !== 'string') {
        return {
            error: {
                status: 400,
                id: 'INVALID_CATEGORY_TYPE',
                message: 'category must be a string'
            }
        };
    }


// Validate empty text fields.
    if (truncatedDescription.trim() === '' || category.trim() === '') {
        return {
            error: {
                status: 400,
                id: 'EMPTY_COST_FIELDS',
                message: 'description and category cannot be empty'
            }
        };
    }


    // Validate that the category is one of the allowed categories.
    if (!categories.includes(category)) {
        return {
            error: {
                status: 400,
                id: 'INVALID_CATEGORY',
                message: 'category must be food, health, housing, sports or education'
            }
        };
    }

    const numericUserId = Number(userid);
    const numericSum = Number(sum);

    // Validate that the userid is numeric.
    if (!Number.isFinite(numericUserId)) {
        return {
            error: {
                status: 400,
                id: 'INVALID_USER_ID',
                message: 'userid must be a number'
            }
        };
    }

    // Validate that the sum is a valid non-negative number.
    if (!Number.isFinite(numericSum) || numericSum <= 0) {
        return {
            error: {
                status: 400,
                id: 'INVALID_SUM',
                message: 'sum must be a positive number'
            }
        };
    }

    let costDate = new Date();

// Optional created_at support, mainly used for testing and validation.
    if (created_at) {
        costDate = new Date(created_at);
        if (Number.isNaN(costDate.getTime())) {
            return {
                error: {
                    status: 400,
                    id: 'INVALID_DATE',
                    message: 'created_at must be a valid date'
                }
            };
        }

        // Validate that the cost date is not in the past.
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        if (costDate < todayStart) {
            return {
                error: {
                    status: 400,
                    id: 'PAST_DATE_NOT_ALLOWED',
                    message: 'costs with past dates are not allowed'
                }
            };
        }
    }

    return {
        numericUserId,
        numericSum,
        costDate,
        truncatedDescription
    };

}

//checks if user already exists.
async function validateUserExists(userid) {
    const user = await User.findOne({id: userid});

    if (!user) {
        return {
            error: {
                status: 404,
                id: 'USER_NOT_FOUND',
                message: 'user not found'
            }
        };
    }

    return {user};
}

// Create the cost in MongoDB.
async function createCost(description, category, numericUserId, numericSum, costDate) {
    return await Cost.create({description, category, userid: numericUserId, sum: numericSum, created_at: costDate});
}


// Validates request and creates a new cost for an existing user in the database.
app.post('/api/add', async (req, res) => {
    try {
        await saveLog(req.method, req.originalUrl, '/api/add', 200, 'add cost endpoint accessed');

        const {description, category, userid, sum, created_at} = req.body || {} ;

        // Validate input
        const validation = validateCostInput(description, category, userid, sum, created_at);

        if (validation.error) {
            return res
                .status(validation.error.status)
                .json({
                    id: validation.error.id,
                    message: validation.error.message
                });
        }


        const {numericUserId, numericSum, costDate, truncatedDescription} = validation;


        const userCheck = await validateUserExists(numericUserId);
        if (userCheck.error) {
            return res
                .status(userCheck.error.status)
                .json({
                    id: userCheck.error.id,
                    message: userCheck.error.message
                });
        }


        // Save cost
        const cost = await createCost(truncatedDescription, category, numericUserId, numericSum, costDate);


        // Return response
        res.status(201).json({
            userid: cost.userid,
            description: cost.description,
            category: cost.category,
            sum: Number(cost.sum),
            created_at: cost.created_at
        })


    } catch (error) {
        res.status(500).json({
            id: 'ADD_COST_ERROR',
            message: error.message
        });
    }
});


/*
  Validates the parameters for generating a report.
  Checks that userid, year, and month are valid numbers,
  ensures required values are integers, and verifies they fall within acceptable ranges.
*/
function validateReportParams(userid, year, month) {

    if (!Number.isFinite(userid) || !Number.isFinite(year) || !Number.isFinite(month)) {
        return {
            error: {
                status: 400,
                id: 'INVALID_REPORT_PARAMS',
                message: 'id, year and month must be numbers'
            }
        };
    }

    if (!Number.isInteger(userid) || userid <= 0 || !Number.isInteger(year) || year <= 0 || !Number.isInteger(month)) {
        return {
            error: {
                status: 400,
                id: 'INVALID_REPORT_PARAMS',
                message: 'id, year and month must be whole numbers'
            }
        };
    }

    // Validate month range.
    if (month < 1 || month > 12) {
        return {
            error: {
                status: 400,
                id: 'INVALID_MONTH',
                message: 'month must be between 1 and 12'
            }
        };
    }

    return {
        userid, year, month
    };
}


// Return a monthly report for a specific user, year and month.
app.get('/api/report', async (req, res) => {
    try {
        await saveLog(req.method, req.originalUrl, '/api/report', 200, 'report endpoint accessed');

        const userid = Number(req.query.id);
        const year = Number(req.query.year);
        const month = Number(req.query.month);

        const validation = validateReportParams(userid, year, month);

        if (validation.error) {
            return res.status(validation.error.status).json({
                id: validation.error.id,
                message: validation.error.message
            });
        }

        // Ensure user exists before generating report
        const userCheck = await validateUserExists(userid);

        if (userCheck.error) {
            return res
                .status(userCheck.error.status)
                .json({
                    id: userCheck.error.id,
                    message: userCheck.error.message
                });
        }


        // Generate or retrieve monthly report (cached or computed).
        const report = await getMonthlyReport(userid, year, month);

        res.status(200).json(normalizeReport(report));
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

