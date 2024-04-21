const express = require('express');
const router = express.Router();
const Attendance = require('../models/attendance');
const Class = require('../models/class');

// Middleware to verify if the user is a teacher
function verifyTeacher(req, res, next) {
    if (req.session.userRole !== 'teacher') {
        return res.status(403).send('Access denied. Teachers only.');
    }
    next();
}

// Route to display the attendance form
router.get('/attendance/:classId', verifyTeacher, async (req, res) => {
    try {
        const classInfo = await Class.findById(req.params.classId).populate('students', 'username');
        if (!classInfo) {
            return res.status(404).send('Class not found');
        }
        res.render('attendance-form', { classInfo });
    } catch (error) {
        res.status(500).send('Error displaying attendance form');
    }
});

router.post('/attendance/:classId', verifyTeacher, async (req, res) => {
    const attendanceRecords = req.body.attendance;
    if (!Array.isArray(attendanceRecords)) {
        console.error('Expected attendanceRecords to be an array, got:', attendanceRecords);
        return res.status(400).send('Invalid attendance data');
    }
    try {
        const newAttendance = new Attendance({
            class: req.params.classId,
            records: attendanceRecords.map(record => ({
                student: record.student,
                status: record.status
            }))
        });
        await newAttendance.save();
        // Now update the Class document to include this new attendance record
        await Class.findByIdAndUpdate(req.params.classId, {
            $push: { attendanceRecords: newAttendance._id }
        });
        res.redirect('/classes/view-class/' + req.params.classId);
    } catch (error) {
        console.error('Error recording attendance:', error);
        res.status(500).send('Error saving attendance record');
    }
});

module.exports = router;
