const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    read: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});

notificationSchema.index({ user: 1, type: 1, class: 1, read: 1 }, { unique: true });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
