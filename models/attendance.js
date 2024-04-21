const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    date: { type: Date, default: Date.now },
    records: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['Present', 'Absent'], required: true }
    }]
});

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;
