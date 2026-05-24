const mongoose = require('mongoose');

/*
 This model represents a log message in the database.
 Each service uses this model in order to save requests and endpoint access.
*/
const logSchema = new mongoose.Schema({
    service: {
        type: String,
        required: true
    },

    method: {
        type: String,
        required: true
    },

    url: {
        type: String,
        required: true
    },

    endpoint: {
        type: String,
        required: true
    },

    status: {
        type: Number,
        required: true
    },

    message: {
        type: String,
        required: true
    },

    created_at: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'logs',
    versionKey: false
});

module.exports = mongoose.model('Log', logSchema);