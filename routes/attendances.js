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
        res.redirect('/teachers/view-class/' + req.params.classId);
    } catch (error) {
        console.error('Error recording attendance:', error);
        res.status(500).send('Error saving attendance record');
    }
});


// Route to get attendance data for a class
router.get('/attendance-data/:classId', verifyTeacher, async (req, res) => {
    const classId = req.params.classId;

    try {
        const attendanceRecords = await Attendance.find({ class: classId }).exec();

        // Consolidate the data by date
        const consolidatedData = attendanceRecords.reduce((acc, record) => {
            const date = record.date.toISOString().split('T')[0];
            const presentCount = record.records.filter(r => r.status === 'Present').length;
            const absentCount = record.records.filter(r => r.status === 'Absent').length;

            if (!acc[date]) {
                acc[date] = { date, presentCount: 0, absentCount: 0 };
            }

            acc[date].presentCount += presentCount;
            acc[date].absentCount += absentCount;

            return acc;
        }, {});

        // Convert consolidated data to an array
        const processedData = Object.values(consolidatedData);

        console.log('Processed Attendance Data:', processedData);
        res.json(processedData);
    } catch (error) {
        console.error('Error retrieving attendance data:', error);
        res.status(500).json({ error: 'Failed to retrieve attendance data' });
    }
});

module.exports = router;
