const mongoose = require('mongoose');

/*
 This model is used for the computed design pattern.
 Reports for months that already passed can be saved and reused later.
*/

const monthlyReportSchema = new mongoose.Schema({
    userid: {
        type: Number,
        required: true
    },

    year: {
        type: Number,
        required: true
    },

    month: {
        type: Number,
        required: true
    },

    costs: {
        type: [mongoose.Schema.Types.Mixed],
        required: true
    },

    created_at: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'monthlyReports',
    versionKey: false
});

// A user should have only one saved report for a specific month and year.
monthlyReportSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyReport', monthlyReportSchema);