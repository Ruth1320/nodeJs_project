require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const pino = require('pino');
const User = require('./models/user.model');
const Cost = require('./models/cost.model');
const Log = require('./models/log.model');

const app = express();
const logger = pino();

// Enable CORS and JSON request body parsing.
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 4002;
const serviceName = process.env.SERVICE_NAME || 'users';

/*
 Saves log messages with Pino and also stores them in MongoDB.
 This helps us keep a record of requests and important endpoint actions.
*/
async function saveLog(method, url, endpoint, status, message) {
    try {
        logger.info({method, url, endpoint, status}, message);

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


function validateUserInput(id, first_name, last_name, birthday) {
    // Validate that all required user fields were sent.
    if (id === undefined || !first_name || !last_name || !birthday) {
        return {
            error: {
                status: 400,
                id: 'MISSING_USER_DATA',
                message: 'id, first_name, last_name and birthday are required'
            }
        };
    }

    // Validate the string's type.
    if (typeof first_name !== 'string' || typeof last_name !== 'string') {
        return {
            error: {
                status: 400,
                id: 'INVALID_NAME',
                message: 'first_name and last_name must be strings'
            }
        };
    }


    if (first_name.trim() === '' || last_name.trim() === '') {
        return {
            error: {
                status: 400,
                id: 'INVALID_NAME',
                message: 'first_name and last_name cannot be empty'
            }
        };
    }


    const numericId = Number(id);
    const birthDate = new Date(birthday);

    // Validate that the user id is numeric.
    if (!Number.isFinite(numericId)) {
        return {
            error: {
                status: 400,
                id: 'INVALID_USER_ID',
                message: 'id must be a number'
            }
        };
    }

    // Validate that the birthday value is a valid date.
    if (Number.isNaN(birthDate.getTime())) {
        return {
            error: {
                status: 400,
                id: 'INVALID_BIRTHDAY',
                message: 'birthday must be a valid date'
            }
        };
    }

    return {
        numericId,
        birthDate
    };
}


// Check if a user with the same id already exists.
async function checkUserExists(numericId) {
    const existingUser = await User.findOne({id: numericId});

    if (existingUser) {
        return {
            error: {
                status: 400,
                id: 'USER_ALREADY_EXISTS',
                message: 'user already exists'
            }
        };
    }

    return {success: true};
}

// Create the new user in MongoDB.
async function createUser(numericId, first_name, last_name, birthDate) {
    return await User.create({
        id: numericId,
        first_name,
        last_name,
        birthday: birthDate
    });
}


// Add a new user to the users collection.
app.post('/api/add', async (req, res) => {
    try {
        await saveLog(req.method, req.originalUrl, '/api/add', 200, 'add user endpoint accessed');

        const {id, first_name, last_name, birthday} = req.body || {} ;


        // Validate input
        const validation = validateUserInput(id, first_name, last_name, birthday);

        if (validation.error) {
            return res
                .status(validation.error.status)
                .json({
                    id: validation.error.id,
                    message: validation.error.message
                });
        }

        const {numericId, birthDate } = validation;

        // Check if user already exists
        const userCheck = await checkUserExists(numericId);

        if (userCheck.error) {
            return res
                .status(userCheck.error.status)
                .json({
                    id: userCheck.error.id,
                    message: userCheck.error.message
                });
        }

        // Create user
        const user = await createUser(numericId, first_name, last_name, birthDate);

        // Return response
        res.status(201).json({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            birthday: user.birthday
        });
    } catch (error) {
        res.status(500).json({
            id: 'ADD_USER_ERROR',
            message: error.message
        });
    }
});

// Return all users, sorted by id.
app.get('/api/users', async (req, res) => {
    try {
        await saveLog(req.method, req.originalUrl, '/api/users', 200, 'users list endpoint accessed');

        const users = await User.find({}, {_id: 0, __v: 0}).sort({id: 1});

        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({
            id: 'USERS_LIST_ERROR',
            message: error.message
        });
    }
});

//Checks that the user ID is a real number
function validateUserid(numericId) {
    if (!Number.isFinite(numericId)) {
        return {
            error: {
                status: 400,
                id: 'INVALID_USER_ID',
                message: 'id must be a number'
            }
        };
    }

    return { numericId };
}

// Search the user in MongoDB.
async function getUserById(numericId) {
    const user = await User.findOne({ id: numericId });

    if (!user) {
        return {
            error: {
                status: 404,
                id: 'USER_NOT_FOUND',
                message: 'user not found'
            }
        };
    }

    return { user};
}


// Calculate the total costs of the user using MongoDB aggregation.
async function getUserTotalCosts(numericId) {
    const totalResult = await Cost.aggregate([
        { $match: { userid: numericId } },
        { $group: { _id: null, total: { $sum: '$sum' } } }
    ]);

    const total = totalResult.length > 0 ? Number(totalResult[0].total) : 0;
    return total;

}

// Return one user by id, including the total cost amount of that user.
app.get('/api/users/:id', async (req, res) => {
    try {
        await saveLog(req.method, req.originalUrl, '/api/users/:id', 200, 'user details endpoint accessed');

        const numericId = Number(req.params.id);

        // Validate id
        const validation = validateUserid(numericId);
        if (validation.error) {
            return res
                .status(validation.error.status)
                .json({
                    id: validation.error.id,
                    message: validation.error.message
                });
        }

        // Get user
        const user = await getUserById(numericId);
        if (user.error) {
            return res
                .status(user.error.status)
                .json({
                    id: user.error.id,
                    message: user.error.message
                });
        }

        // Extract the actual user document returned by getUserById.
        const userData = user.user;

        const total = await getUserTotalCosts(numericId);

        res.status(200).json({
            first_name: userData.first_name,
            last_name: userData.last_name,
            id: userData.id,
            total
        });
    } catch (error) {
        res.status(500).json({
            id: 'USER_DETAILS_ERROR',
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

// Connect to MongoDB and start the users service.
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(port, () => {
            logger.info(`users service is running on port ${port}`);
        });
    })
    .catch((error) => {
        logger.error(error);
    });