const mongoose = require('mongoose');

/*
 This model represents a user in the users collection.
 The id field is different from the MongoDB _id field.
*/
const userSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
    },

    first_name: {
        type: String,
        required: true
    },

    last_name: {
        type: String,
        required: true
    },

    birthday: {
        type: Date,
        required: true
    }
}, {
    collection: 'users',
    versionKey: false
});

module.exports = mongoose.model('User', userSchema);