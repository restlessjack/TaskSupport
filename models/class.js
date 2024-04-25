const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    name: { type: String, required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // assuming students are also users
    attendanceRecords: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' }],
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }]

});

const Class = mongoose.model('Class', classSchema);
module.exports = Class;
