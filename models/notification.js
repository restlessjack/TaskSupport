const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    read: { type: Boolean, default: false },
    dontShowAgain: { type: Boolean, default: false }, // Add this field to handle "don't show again"
    date: { type: Date, default: Date.now },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }, // Add task reference
    readAt: { type: Date } // New field to track when the notification was read
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
