const express = require('express');
const router = express.Router();
const Class = require('../models/class');
const User = require('../models/user');
const Task = require('../models/task'); // Assuming you have this model from previous discussions

// Assuming you have a route or function to create a task
router.post('/create-task/:classId', verifyTeacher, async (req, res) => {
    const { description } = req.body;
    const classId = req.params.classId;

    try {
        const classInfo = await Class.findById(classId);
        if (!classInfo) {
            console.error('Class not found with ID:', classId);
            return res.status(404).send('Class not found');
        }

        const completions = classInfo.students.map(studentId => ({
            student: studentId,
            completed: false // All marked as incomplete initially
        }));

        // Create a new task with completions pre-populated
        const newTask = new Task({
            description,
            class: classId,
            completions: completions
        });

        // Make sure to assign the result of the save operation to a variable
        const savedTask = await newTask.save();

        // Update the class document to include the new task
        await Class.findByIdAndUpdate(classId, {
            $push: { tasks: savedTask._id }
        });

        res.redirect('classes/view-class' + classId);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).send('Failed to create task');
    }
});


// Middleware to verify if the user is a teacher
function verifyTeacher(req, res, next) {
    // Assuming teacher's ID is stored in the session after authentication
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
        const username = req.session.username;  // Assuming username is stored in session
        res.render('teacher-dashboard', {
            username
        });
    } catch (error) {
        console.error('Dashboard access error:', error);
        res.status(500).send('Failed to load dashboard');
    }
});

// Create a New Class
router.post('/create-class', verifyTeacher, async (req, res) => {
    const { name } = req.body;
    const teacherId = req.session.userId; // Assuming teacher's ID is stored in session
    try {
        const newClass = new Class({
            name,
            teacher: teacherId
        });
        await newClass.save();
        res.status(201).json({ message: 'Class created successfully', classId: newClass._id });
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).send('Failed to create class');
    }
});

router.get('/view-classes', verifyTeacher, async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.session.userId }).populate('students', 'username');
        res.render('view-classes', { classes });
    } catch (error) {
        console.error('Error retrieving classes:', error);
        res.status(500).render('error', { message: 'Failed to load classes' });
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
        res.json(updatedClass);
    } catch (error) {
        console.error('Error removing student:', error);
        res.status(500).send('Failed to remove student');
    }
});


router.get('/teacher-dashboard', authMiddleware, async (req, res) => {
    try {
        const username = req.session.username;  // Assuming username is stored in session
        res.render('teacher-dashboard', {
            username: username
        });
    } catch (error) {
        console.error('Dashboard access error:', error);
        res.status(500).send('Failed to load dashboard');
    }
});

module.exports = router;
