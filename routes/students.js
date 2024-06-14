const express = require('express');
const router = express.Router();
const Class = require('../models/class');
const Notification = require('../models/notification');
const Attendance = require('../models/attendance');
const Task = require('../models/task');
const mongoose = require('mongoose');

function verifyStudent(req, res, next) {
    if (!req.session.userId || req.session.userRole !== 'student') {
        return res.status(403).send('Access denied. Students only.');
    }
    next();
}

async function calculateClassAttendance(classId, userId) {
    const attendanceDocs = await Attendance.find({ class: classId }).select('records.student records.status');

    // Flatten the records into a single array of { student, status }
    const allAttendanceRecords = attendanceDocs.flatMap(doc => doc.records.map(record => ({
        student: record.student,
        status: record.status
    })));

    // Calculate the total attendance percentage
    const totalAttendancePercentage = calculatePercent(allAttendanceRecords);

    let studentAttendancePercentage = 0;
    if (userId) {
        const studentRecords = allAttendanceRecords.filter(record =>
            record.student.toString() === userId.toString());
        studentAttendancePercentage = calculatePercent(studentRecords);
    }

    return {
        totalAttendancePercentage,
        studentAttendancePercentage
    };
}

function calculatePercent(records) {
    if (records.length === 0) return 0;

    const totalSessions = records.length;
    const totalPresent = records.filter(record => record.status === 'Present').length;

    return (totalPresent / totalSessions) * 100;
}

async function generateAttendanceNotifications(req, res, next) {
    try {
        const userId = req.session.userId;
        const classes = await Class.find({ students: userId });

        await Promise.all(classes.map(async classInfo => {
            const { studentAttendancePercentage } = await calculateClassAttendance(classInfo._id, userId);

            if (studentAttendancePercentage < 75) { // Assuming 75% as the threshold
                const existingNotification = await Notification.findOne({
                    user: userId,
                    type: 'Low Attendance',
                    class: classInfo._id,
                    read: false
                });

                if (!existingNotification) {
                    const notification = new Notification({
                        user: userId,
                        type: 'Low Attendance',
                        class: classInfo._id,
                        message: `Your attendance in ${classInfo.name} is below 75%. Current attendance: ${studentAttendancePercentage.toFixed(2)}%.`,
                        read: false
                    });
                    await notification.save();
                }
            }
        }));

        next();
    } catch (error) {
        console.error('Error generating notifications:', error);
        res.status(500).send('Failed to generate notifications');
    }
}

router.get('/student-dashboard', verifyStudent, generateAttendanceNotifications, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.userId); // Convert session userId to ObjectId

        // Calculate total attendance percentage using MongoDB aggregation
        const results = await Attendance.aggregate([
            { $unwind: "$records" },
            { $match: { "records.student": userId } },
            {
                $group: {
                    _id: "$records.student",
                    totalSessions: { $sum: 1 },
                    totalPresent: {
                        $sum: {
                            $cond: [{ $eq: ["$records.status", "Present"] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalAttendancePercentage: {
                        $cond: [
                            { $eq: ["$totalSessions", 0] },
                            0,
                            { $multiply: [{ $divide: ["$totalPresent", "$totalSessions"] }, 100] }
                        ]
                    }
                }
            }
        ]);

        const totalAttendancePercentage = results.length > 0 ? results[0].totalAttendancePercentage : 0;

        const taskResults = await Task.aggregate([
            { $unwind: "$completions" },
            { $match: { "completions.student": new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: "$completions.student",
                    totalTasks: { $sum: 1 },
                    totalCompleted: {
                        $sum: {
                            $cond: [{ $eq: ["$completions.completed", true] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalTaskCompletionPercentage: {
                        $cond: [
                            { $eq: ["$totalTasks", 0] },
                            0,
                            { $multiply: [{ $divide: ["$totalCompleted", "$totalTasks"] }, 100] }
                        ]
                    }
                }
            }
        ]);

        const totalTaskCompletionPercentage = taskResults.length > 0 ? taskResults[0].totalTaskCompletionPercentage : 0;

        res.render('student-dashboard', {
            username: req.session.username,
            totalAttendancePercentage: totalAttendancePercentage.toFixed(2),
            totalTaskCompletionPercentage: totalTaskCompletionPercentage.toFixed(2) // Formatting to 2 decimal places
        });
    } catch (error) {
        console.error('Dashboard access error for student:', error);
        res.status(500).send('Failed to load student dashboard');
    }
});

router.get('/student-classes', verifyStudent, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.userId);
        const classes = await Class.find({ students: userId }).populate('teacher', 'username');

        res.render('student-classes', {
            username: req.session.username,
            classes: classes
        });
    } catch (error) {
        console.error('Error retrieving classes for student:', error);
        res.status(500).send('Failed to load classes');
    }
});

router.get('/student-class-details/:classId', verifyStudent, async (req, res) => {
    try {
        const classId = new mongoose.Types.ObjectId(req.params.classId);
        const userId = req.session.userId;

        const classInfo = await Class.findById(classId).populate('tasks');
        const tasks = classInfo.tasks || [];

        const { totalAttendancePercentage, studentAttendancePercentage } = await calculateClassAttendance(classId, userId);

        res.render('student-class-details', {
            className: classInfo.name,
            totalAttendancePercentage: totalAttendancePercentage.toFixed(2),
            studentAttendancePercentage: studentAttendancePercentage.toFixed(2),
            tasks: tasks,
            userId: userId
        });
    } catch (error) {
        console.error('Error retrieving class and task details for student:', error);
        res.status(500).send('Failed to retrieve class and task details');
    }
});

router.get('/student-incomplete-tasks', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Fetch tasks where the student's completions are marked as false
        const tasks = await Task.find({
            "completions.student": userId,
            "completions.completed": false
        }).populate({
            path: 'completions',
            match: { student: userId, completed: false }
        });

        res.render('student-incomplete-tasks', {
            tasks: tasks,
            userId: userId
        });
    } catch (error) {
        console.error('Error retrieving incomplete tasks:', error);
        res.status(500).send('Failed to retrieve incomplete tasks');
    }
});

router.post('/mark-tasks-complete', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { completedTasks } = req.body;

        if (!completedTasks) {
            return res.redirect('/students/student-incomplete-tasks');
        }

        const taskIds = Array.isArray(completedTasks) ? completedTasks : [completedTasks];

        await Promise.all(taskIds.map(async taskId => {
            await Task.updateOne(
                { _id: taskId, "completions.student": userId },
                { $set: { "completions.$.completed": true, "completions.$.new": false } }
            );
        }));

        return res.redirect('/students/student-incomplete-tasks');
    } catch (error) {
        console.error('Error marking tasks as complete:', error);
        res.status(500).send('Failed to mark tasks as complete');
    }
});

router.get('/student-new-tasks', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Fetch new tasks for the student
        const tasks = await Task.find({
            "completions.student": userId,
            "completions.completed": false,
            "completions.new": true
        }).populate('class', 'name');

        res.json({ tasks: tasks });
    } catch (error) {
        console.error('Error retrieving new tasks:', error);
        res.status(500).send('Failed to retrieve new tasks');
    }
});

// View notifications for a student
router.get('/student-notifications', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId;
        const notifications = await Notification.find({ user: userId });

        res.render('student-notifications', { notifications });
    } catch (error) {
        console.error('Error retrieving notifications:', error);
        res.status(500).send('Failed to retrieve notifications');
    }
});

module.exports = router;
