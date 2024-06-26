const express = require('express');
const router = express.Router();
const Class = require('../models/class');
const User = require('../models/user');
const Task = require('../models/task');
const Attendance = require('../models/attendance');
const { calculatePercent } = require('../utils/calculationUtils');
const { changeUserPassword } = require('../utils/userUtils'); // Adjust path if necessary

// Middleware to verify if the user is a teacher
function verifyTeacher(req, res, next) {
    if (!req.session.userId || req.session.userRole !== 'teacher') {
        return res.status(403).send('Access denied. Teachers only.');
    }
    next();
}

function authMiddleware(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).redirect('/login');
    }
    next();
}

// Teacher dashboard route
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const username = req.session.username;
        res.render('teacher-dashboard', { username });
    } catch (error) {
        console.error('Dashboard access error:', error);
        res.status(500).send('Failed to load dashboard');
    }
});

// Create a New Class
router.post('/create-class', verifyTeacher, async (req, res) => {
    const { name } = req.body;
    const teacherId = req.session.userId;
    try {
        const newClass = new Class({ name, teacher: teacherId });
        await newClass.save();
        res.status(201).json({ message: 'Class created successfully', classId: newClass._id });
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).send('Failed to create class');
    }
});

// Get all classes for a teacher
router.get('/view-classes', verifyTeacher, async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.session.userId }).populate('students', 'username');
        res.render('view-classes', { classes });
    } catch (error) {
        console.error('Error retrieving classes:', error);
        res.status(500).render('error', { message: 'Failed to load classes' });
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
        res.json({ success: true, redirect: '/teachers/view-classes' });
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).json({ success: false, message: 'Error creating class' });
    }
});

// Route to edit a class form
router.get('/edit-class/:id', verifyTeacher, async (req, res) => {
    try {
        const classInfo = await Class.findById(req.params.id).populate('students', 'username');
        if (!classInfo) {
            return res.status(404).send('Class not found');
        }
        res.render('edit-class', { classInfo });
    } catch (error) {
        res.status(500).send('Error loading edit form');
    }
});

// Route to update a class
router.post('/edit-class/:id', verifyTeacher, async (req, res) => {
    const { name, students } = req.body;
    try {
        const studentIds = await User.find({ username: { $in: students } }).select('_id');
        const updatedClass = {
            name,
            students: studentIds.map(s => s._id)
        };
        await Class.findByIdAndUpdate(req.params.id, updatedClass);
        res.redirect('/teachers/view-classes');
    } catch (error) {
        console.error('Error updating class:', error);
        res.status(500).send('Error updating class');
    }
});

// Add a student to a class
router.put('/add-student', verifyTeacher, async (req, res) => {
    const { classId, studentId } = req.body;
    try {
        const updatedClass = await Class.findByIdAndUpdate(classId, {
            $addToSet: { students: studentId }
        }, { new: true }).populate('students', 'username');
        res.json(updatedClass);
    } catch (error) {
        console.error('Error adding student:', error);
        res.status(500).send('Failed to add student');
    }
});

// Remove a student from a class
router.put('/remove-student', verifyTeacher, async (req, res) => {
    const { classId, studentId } = req.body;
    try {
        const updatedClass = await Class.findByIdAndUpdate(classId, {
            $pull: { students: studentId }
        }, { new: true }).populate('students', 'username');

        // Remove student's attendance and task completions related to the class
        await Attendance.updateMany(
            { class: classId },
            { $pull: { records: { student: studentId } } }
        );

        await Task.updateMany(
            { class: classId },
            { $pull: { completions: { student: studentId } } }
        );

        res.json(updatedClass);
    } catch (error) {
        console.error('Error removing student:', error);
        res.status(500).send('Failed to remove student');
    }
});

// Delete a class
router.post('/delete-class/:id', verifyTeacher, async (req, res) => {
    try {
        const classId = req.params.id;
        await Class.findByIdAndDelete(classId);
        await Attendance.deleteMany({ class: classId });
        await Task.deleteMany({ class: classId });
        res.redirect('/teachers/view-classes');
    } catch (error) {
        res.status(500).send('Error deleting class');
    }
});

router.post('/create-task/:classId', verifyTeacher, async (req, res) => {
    const { description, importance, optionalDueDate } = req.body;
    const classId = req.params.classId;

    try {
        const classInfo = await Class.findById(classId);
        if (!classInfo) {
            return res.status(404).send('Class not found');
        }

        const completions = classInfo.students.map(studentId => ({
            student: studentId,
            completed: false
        }));

        const newTask = new Task({
            description,
            class: classId,
            completions: completions,
            importance: importance || 'medium',
            optionalDueDate: optionalDueDate || null
        });

        const savedTask = await newTask.save();

        await Class.findByIdAndUpdate(classId, {
            $push: { tasks: savedTask._id }
        });

        res.redirect('/teachers/view-class/' + classId);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).send('Failed to create task');
    }
});


// View class details
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
        const attendanceDocs = await Attendance.find({ class: classId }).select('records.student records.status');

        // Flatten the records into a single array of { student, status }
        const allAttendanceRecords = attendanceDocs.flatMap(doc => doc.records.map(record => ({
            student: record.student,
            status: record.status
        })));

        // Calculate the total attendance percentage
        const totalAttendancePercentage = calculatePercent(allAttendanceRecords);

        let studentAttendancePercentages = classInfo.students.map(student => {
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

router.get('/manage-tasks/:classId', verifyTeacher, async (req, res) => {
    try {
        const classId = req.params.classId;
        const classInfo = await Class.findById(classId).populate('tasks').exec();

        if (!classInfo) {
            return res.status(404).send('Class not found');
        }

        res.render('manage-tasks', { classInfo });
    } catch (error) {
        console.error('Error retrieving tasks:', error);
        res.status(500).render('error', { message: 'Failed to load tasks' });
    }
});

// Route to edit a task form
router.get('/edit-task/:taskId', verifyTeacher, async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId);

        if (!task) {
            return res.status(404).send('Task not found');
        }

        res.render('edit-task', { task });
    } catch (error) {
        res.status(500).send('Error loading edit form');
    }
});

// Route to update a task
router.post('/edit-task/:taskId', verifyTeacher, async (req, res) => {
    const { description, importance, optionalDueDate } = req.body;
    try {
        await Task.findByIdAndUpdate(req.params.taskId, { description, importance, optionalDueDate });
        res.redirect('/teachers/manage-tasks/' + req.body.classId);
    } catch (error) {
        res.status(500).send('Error updating task');
    }
});

// Route to delete a task
router.post('/delete-task/:taskId', verifyTeacher, async (req, res) => {
    try {
        const taskId = req.params.taskId;
        await Task.findByIdAndDelete(taskId);
        res.redirect('/teachers/manage-tasks/' + req.body.classId);
    } catch (error) {
        res.status(500).send('Error deleting task');
    }
});



// Display teacher settings page
router.get('/settings', verifyTeacher, async (req, res) => {
    res.render('teacher-settings', { message: null, messageType: null });
});


// Route for handling password change
router.post('/change-password', verifyTeacher, async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.userId;

    const result = await changeUserPassword(userId, oldPassword, newPassword, confirmPassword);

    if (result.success) {
        res.render('teacher-settings', { message: result.message, messageType: 'success' });
    } else {
        res.render('teacher-settings', { message: result.message, messageType: 'error' });
    }
});






module.exports = router;
