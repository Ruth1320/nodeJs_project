const mongoose = require('mongoose');

/*
 This model represents a log message in the database.
 The about service uses this model to save endpoint access logs.
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
},
    {
    collection: 'logs',
    versionKey: false
});

module.exports = mongoose.model('Log', logSchema);