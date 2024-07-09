const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Class = require('../models/class');
const User = require('../models/user');
const Task = require('../models/task');
const Attendance = require('../models/attendance');
const Notification = require('../models/notification');
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


router.get('/view-classes', verifyTeacher, async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.session.userId }).populate('students', 'username');
        const message = req.query.message || '';
        const messageType = req.query.messageType || '';
        res.render('view-classes', { classes, message, messageType });
    } catch (error) {
        console.error('Error retrieving classes:', error);
        res.status(500).render('error', { message: 'Failed to load classes' });
    }
});

// Delete a class
router.post('/delete-class/:id', verifyTeacher, async (req, res) => {
    try {
        const classId = req.params.id;
        const classInfo = await Class.findByIdAndDelete(classId);

        if (!classInfo) {
            return res.status(404).redirect('/teachers/view-classes?message=Class not found&messageType=error');
        }

        await Attendance.deleteMany({ class: classId });
        await Task.deleteMany({ class: classId });
        await Notification.deleteMany({ class: classId });

        

        res.redirect('/teachers/view-classes?message=Class deleted successfully&messageType=success');
    } catch (error) {
        res.status(500).redirect('/teachers/view-classes?message=Error deleting class&messageType=error');
    }
});



// Route to create a new class form
// Route to create a new class form
router.get('/create', verifyTeacher, (req, res) => {
    res.render('create-class', { message: '', messageType: '' });
});

// Consolidated Create Class Route
router.post('/create', verifyTeacher, [
    body('name').trim().notEmpty().withMessage('Class name is required'),
    body('students').isArray().withMessage('Students should be an array of usernames')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array().map(err => err.msg).join(', ') });
    }

    const { name, students } = req.body;
    try {
        const studentIds = await User.find({ username: { $in: students } }).select('_id');
        if (studentIds.length !== students.length) {
            return res.status(400).json({ success: false, message: 'One or more student usernames are invalid' });
        }
        const newClass = new Class({
            name,
            teacher: req.session.userId,
            students: studentIds.map(s => s._id)
        });
        await newClass.save();
        res.status(200).json({ success: true, redirect: '/teachers/view-classes?message=Class Created Sucessfully&messageType=success' });
        
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
        res.render('edit-class', { classInfo, message: '', messageType: '' });
    } catch (error) {
        res.status(500).send('Error loading edit form');
    }
});

// Route to update a class
router.post('/edit-class/:id', verifyTeacher, [
    body('name').trim().notEmpty().withMessage('Class name is required'),
    body('students').isArray().withMessage('Students should be an array of usernames')
], async (req, res) => {
    const errors = validationResult(req);
    const classInfo = await Class.findById(req.params.id).populate('students', 'username');

    if (!errors.isEmpty()) {
        return res.render('edit-class', {
            classInfo,
            message: errors.array().map(err => err.msg).join(', '),
            messageType: 'error'
        });
    }

    const { name, students } = req.body;
    try {
        const studentIds = await User.find({ username: { $in: students } }).select('_id');
        if (studentIds.length !== students.length) {
            return res.render('edit-class', {
                classInfo,
                message: 'One or more student usernames are invalid',
                messageType: 'error'
            });
        }
        const updatedClass = {
            name,
            students: studentIds.map(s => s._id)
        };
        await Class.findByIdAndUpdate(req.params.id, updatedClass);
        res.redirect('/teachers/view-classes?message=Class Updated Successfully&messageType=success');
    } catch (error) {
        console.error('Error updating class:', error);
        res.status(500).render('edit-class', {
            classInfo,
            message: 'Error updating class',
            messageType: 'error'
        });
    }
});

// Add a student to a class
router.put('/add-student', verifyTeacher, [
    body('classId').isMongoId().withMessage('Invalid class ID'),
    body('studentId').isMongoId().withMessage('Invalid student ID')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

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
router.put('/remove-student', verifyTeacher, [
    body('classId').isMongoId().withMessage('Invalid class ID'),
    body('studentId').isMongoId().withMessage('Invalid student ID')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

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



router.post('/create-task/:classId', verifyTeacher, [
    body('description').trim().notEmpty().withMessage('Task description is required'),
    body('importance').optional().isIn(['low', 'medium', 'high']).withMessage('Importance must be low, medium, or high'),
    body('optionalDueDate').optional().custom(value => {
        if (!value) return true; // Allow empty value
        return !isNaN(Date.parse(value)); // Check if valid date
    }).withMessage('Optional due date must be a valid date'),
    body('moreInfo').optional().isString().trim().escape().withMessage('More info contains invalid characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array());
    }

    const { description, importance, optionalDueDate, moreInfo } = req.body;
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
            optionalDueDate: optionalDueDate || null,
            moreInfo: moreInfo || null
        });

        const savedTask = await newTask.save();

        await Class.findByIdAndUpdate(classId, {
            $push: { tasks: savedTask._id }
        });

        res.redirect('/teachers/view-class/' + classId + "?message=Task%20Added&messageType=success`");
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).send('Failed to create task');
    }
});

// View class details
router.get('/view-class/:id', verifyTeacher, async (req, res) => {
    try {
        const classId = req.params.id;
        const message = req.query.message || '';
        const messageType = req.query.messageType || '';
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

        res.render('class-details', { classInfo, totalAttendancePercentage, studentAttendancePercentages, message, messageType });
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

        // Reverse the tasks array
        classInfo.tasks.reverse();

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
router.post('/edit-task/:taskId', verifyTeacher, [
    body('description').trim().notEmpty().withMessage('Task description is required'),
    body('importance').optional().isIn(['low', 'medium', 'high']).withMessage('Importance must be low, medium, or high'),
    body('optionalDueDate').optional().isISO8601().withMessage('Optional due date must be a valid date'),
    body('moreInfo').optional().isString().trim().escape().withMessage('More info contains invalid characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).send(errors.array());
    }

    const { description, importance, optionalDueDate, moreInfo } = req.body;
    try {
        await Task.findByIdAndUpdate(req.params.taskId, { description, importance, optionalDueDate, moreInfo });
        res.redirect('/teachers/manage-tasks/' + req.body.classId);
    } catch (error) {
        res.status(500).send('Error updating task');
    }
});

// Route to delete a task
router.post('/delete-task/:taskId', verifyTeacher, async (req, res) => {
    try {
        const taskId = req.params.taskId;

        // Delete the task
        await Task.findByIdAndDelete(taskId);

        // Delete related notifications
        await Notification.deleteMany({ task: taskId });

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
router.post('/change-password', verifyTeacher, [
    body('oldPassword').notEmpty().withMessage('Old password is required'),
    body('newPassword')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
        .matches(/\d/).withMessage('New password must contain a number')
        .matches(/[a-z]/).withMessage('New password must contain a lowercase letter')
        .matches(/[A-Z]/).withMessage('New password must contain an uppercase letter')
        .matches(/[!@#$%^&*]/).withMessage('New password must contain a special character'),
    body('confirmPassword')
        .custom((value, { req }) => value === req.body.newPassword).withMessage('Passwords do not match')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('teacher-settings', {
            message: errors.array().map(error => error.msg).join(', '),
            messageType: 'error'
        });
    }

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
