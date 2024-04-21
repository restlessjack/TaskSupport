const express = require('express');
const router = express.Router();
const Class = require('../models/class');
const User = require('../models/user');
const { calculatePercent } = require('../utils/calculationUtils');
const Attendance = require('../models/attendance');


// Middleware to verify if the user is a teacher
function verifyTeacher(req, res, next) {
    if (req.session.userRole !== 'teacher') {
        return res.status(403).send('Access denied. Teachers only.');
    }
    next();
}

// Get all classes for a teacher
router.get('/', verifyTeacher, async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.session.userId }).populate('students', 'username');
        res.render('view-classes', { classes });
    } catch (error) {
        res.status(500).send('Error retrieving classes');
    }
});

// Route to create a new class form
router.get('/create', verifyTeacher, (req, res) => {
    res.render('create-class');
});

router.post('/create', verifyTeacher, async (req, res) => {
    const { name, students } = req.body;
    try {
        const studentIds = await User.find({ username: { $in: students } }).select('_id');
        const newClass = new Class({
            name,
            teacher: req.session.userId,
            students: studentIds.map(s => s._id)
        });
        await newClass.save();
        res.json({ success: true, redirect: '/teachers/view-classes' }); // Sending success and redirect URL
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).json({ success: false, message: 'Error creating class' });
    }
});

// Route to edit a class form
router.get('/edit/:id', verifyTeacher, async (req, res) => {
    try {
        const classInfo = await Class.findById(req.params.id);
        if (!classInfo) {
            return res.status(404).send('Class not found');
        }
        res.render('edit-class', { classInfo });
    } catch (error) {
        res.status(500).send('Error loading edit form');
    }
});

// Route to update a class
router.post('/edit/:id', verifyTeacher, async (req, res) => {
    const { name, students } = req.body;
    try {
        await Class.findByIdAndUpdate(req.params.id, { name, students });
        res.redirect('/classes');
    } catch (error) {
        res.status(500).send('Error updating class');
    }
});

// Route to delete a class
router.post('/delete/:id', verifyTeacher, async (req, res) => {
    try {
        await Class.findByIdAndDelete(req.params.id);
        res.redirect('/classes');
    } catch (error) {
        res.status(500).send('Error deleting class');
    }
});


router.get('/view-class/:id', verifyTeacher, async (req, res) => {
    try {
        const classId = req.params.id;
        const classInfo = await Class.findById(classId)
            .populate('students', 'username')
            .populate({
                path: 'attendanceRecords',
                populate: {
                    path: 'records.student',
                    model: 'User'
                }
            })
            .exec();

        if (!classInfo) {
            return res.status(404).send('Class not found');
        }
        const attendanceDocs = await Attendance.find({class: classId}).select('records.student records.status');

        // Flatten the records into a single array of { student, status }
        const allAttendanceRecords = attendanceDocs.flatMap(doc => doc.records.map(record => ({
            student: record.student,
            status: record.status
        })));

        console.log(JSON.stringify(allAttendanceRecords, null, 2));

        // Calculate the total attendance percentage
        const totalAttendancePercentage = calculatePercent(allAttendanceRecords);

        let studentAttendancePercentages = classInfo.students.map(student => {
            // Filter out records for this specific student
            const studentRecords = allAttendanceRecords.filter(record => 
                record.student.toString() === student._id.toString());
            
            const attendancePercentage = calculatePercent(studentRecords);
            return {
                username: student.username,
                attendancePercentage
            };
        });

        res.render('class-details', { classInfo, totalAttendancePercentage, studentAttendancePercentages });
    } catch (error) {
        console.error('Error retrieving class details:', error);
        res.status(500).render('error', { message: 'Failed to load class details' });
    }
});






module.exports = router;
