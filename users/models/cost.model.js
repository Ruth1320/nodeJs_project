const mongoose = require('mongoose');

/*
 This model represents a cost item in the costs collection.
 The userid field refers to the regular user id and not to MongoDB _id.
*/
const costSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true
    },

    category: {
        type: String,
        required: true,
        enum: ['food', 'health', 'housing', 'sports', 'education']
    },

    userid: {
        type: Number,
        required: true
    },

    sum: {
        type: mongoose.Schema.Types.Double,
        required: true,
        min: 0
    },

    created_at: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'costs',
    versionKey: false
});

module.exports = mongoose.model('Cost', costSchema);