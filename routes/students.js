const express = require('express');
const router = express.Router();
const Class = require('../models/class');
const Notification = require('../models/notification');
const Attendance = require('../models/attendance');
const Task = require('../models/task');
const mongoose = require('mongoose');
const UserSettings = require('../models/userSettings');

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
        const settings = await UserSettings.findOne({ user: userId });

        await Promise.all(classes.map(async classInfo => {
            const { studentAttendancePercentage } = await calculateClassAttendance(classInfo._id, userId);

            if (studentAttendancePercentage < settings.attendanceThreshold) {
                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);

                const existingNotification = await Notification.findOne({
                    user: userId,
                    type: 'Low Attendance',
                    class: classInfo._id,
                    $or: [
                        { read: false },
                        { dontShowAgain: true },
                        { readAt: { $gt: oneDayAgo } } // Read within the last day
                    ]
                });

                if (!existingNotification) {
                    const notification = new Notification({
                        user: userId,
                        type: 'Low Attendance',
                        class: classInfo._id,
                        message: `Your attendance in ${classInfo.name} is below ${settings.attendanceThreshold}%. Current attendance: ${studentAttendancePercentage.toFixed(2)}%.`,
                        read: false
                    });
                    await notification.save();
                }
            }
        }));

        next();
    } catch (error) {
        console.error('Error generating notifications:', error);
        next(error);
    }
}

async function generateDueDateNotifications(req, res, next) {
    try {
        const userId = req.session.userId;
        const tasks = await Task.find({
            "completions.student": userId,
            "completions.completed": false
        }).populate('class', 'name');

        for (const task of tasks) {
            const classInfo = task.class;
            const completion = task.completions.find(c => c.student.toString() === userId.toString());

            if (completion) {
                const settings = await UserSettings.findOne({ user: completion.student });

                if (settings && task.optionalDueDate) {
                    const dueDate = new Date(task.optionalDueDate);
                    const notificationDate = new Date(dueDate);
                    notificationDate.setDate(dueDate.getDate() - settings.dueDateNotificationDays);

                    if (notificationDate <= new Date() && !completion.new) {
                        const existingNotification = await Notification.findOne({
                            user: completion.student,
                            type: 'Due Date',
                            task: task._id
                        });

                        if (!existingNotification) {
                            const notification = new Notification({
                                user: completion.student,
                                type: 'Due Date',
                                class: classInfo._id,
                                task: task._id,
                                message: `The task "${task.description}" in ${classInfo.name} is due on ${dueDate.toLocaleDateString()}.`,
                                read: false
                            });
                            await notification.save();
                        }
                    }
                }
            }
        }

        next();
    } catch (error) {
        console.error('Error generating due date notifications:', error);
        next(error);
    }
}




router.get('/student-dashboard', verifyStudent, generateAttendanceNotifications, generateDueDateNotifications, async (req, res) => {
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
            path: 'class',
            select: 'name' // Only fetch the class name
        });

        console.log("Fetching tasks for user:", userId);
        console.log("Fetched tasks:", tasks);

        // Mark new tasks as read
        const result = await Task.updateMany(
            { "completions.student": userId, "completions.completed": false, "completions.new": true },
            { $set: { "completions.$[elem].new": false } },
            { arrayFilters: [{ "elem.student": userId }] }
        );

        console.log("Marked new tasks as read:", result);

        const newTasks = tasks.filter(task => 
            task.completions.some(completion => 
                completion.student && completion.student.toString() === userId.toString() && completion.new
            )
        );
        
        const otherTasks = tasks.filter(task => 
            !task.completions.some(completion => 
                completion.student && completion.student.toString() === userId.toString() && completion.new
            )
        );

        console.log("New tasks:", newTasks);
        console.log("Other incomplete tasks:", otherTasks);

        res.render('student-incomplete-tasks', {
            newTasks: newTasks,
            otherTasks: otherTasks,
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
        const notifications = await Notification.find({ user: userId, read: false });

        res.render('student-notifications', { notifications });
    } catch (error) {
        console.error('Error retrieving notifications:', error);
        res.status(500).send('Failed to retrieve notifications');
    }
});

// Display settings page
router.get('/settings', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId;
        let settings = await UserSettings.findOne({ user: userId });

        // If settings do not exist for the user, create default settings
        if (!settings) {
            settings = new UserSettings({ user: userId });
            await settings.save();
        }

        res.render('student-settings', { settings });
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).send('Failed to load settings');
    }
});

// Update settings
router.post('/settings', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { attendanceThreshold, dueDateNotificationDays } = req.body;

        await UserSettings.findOneAndUpdate(
            { user: userId },
            { attendanceThreshold, dueDateNotificationDays },
            { upsert: true, new: true }
        );

        res.redirect('/students/settings');
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).send('Failed to update settings');
    }
});

// Mark a notification as read
router.post('/notifications/read/:id', verifyStudent, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { read: true });
        res.redirect('/students/student-notifications');
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).send('Failed to mark notification as read');
    }
});

// Mark a notification as "don't show again"
router.post('/notifications/dont-show-again/:id', verifyStudent, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { read: true, dontShowAgain: true });
        res.redirect('/students/student-notifications');
    } catch (error) {
        console.error('Error marking notification as "dont show again":', error);
        res.status(500).send('Failed to mark notification as "dont show again"');
    }
});

router.post('/notifications/mark', verifyStudent, async (req, res) => {
    try {
        const { markRead = [], dontShowAgain = [] } = req.body;

        // Mark selected notifications as read
        if (markRead.length > 0) {
            await Notification.updateMany(
                { _id: { $in: markRead } },
                { $set: { read: true } }
            );
        }

        // Mark selected notifications as don't show again
        if (dontShowAgain.length > 0) {
            await Notification.updateMany(
                { _id: { $in: dontShowAgain } },
                { $set: { read: true, dontShowAgain: true } }
            );
        }

        res.redirect('/students/student-notifications');
    } catch (error) {
        console.error('Error marking notifications:', error);
        res.status(500).send('Failed to mark notifications');
    }
});

module.exports = router;
