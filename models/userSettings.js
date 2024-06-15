const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    attendanceThreshold: { type: Number, default: 75 }, // Default to 75%
    dueDateNotificationDays: { type: Number, default: 3 } // Default to 3 days before due date
});

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);
module.exports = UserSettings;
