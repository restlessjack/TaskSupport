const express = require('express');
const router = express.Router();
const Class = require('../models/class');
const Notification = require('../models/notification');
const { calculateClassAttendance } = require('../utils/attendanceUtils');
const Attendance = require('../models/attendance');
const { changeUserPassword } = require('../utils/userUtils'); // Adjust path if necessary
const Task = require('../models/task');
const mongoose = require('mongoose');
const UserSettings = require('../models/userSettings');
const { body, validationResult } = require('express-validator');

function verifyStudent(req, res, next) {
    if (!req.session.userId || req.session.userRole !== 'student') {
        return res.status(403).send('Access denied. Students only.');
    }
    next();
}




async function generateAttendanceNotifications(req, res, next) {
    try {
        const userId = req.session.userId;
        const classes = await Class.find({ students: userId });
        let settings = await UserSettings.findOne({ user: userId });

        if (!settings) {
            settings = new UserSettings({ user: userId });
            await settings.save();
        }

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
                let settings = await UserSettings.findOne({ user: completion.student });

                if (!settings) {
                    settings = new UserSettings({ user: completion.student });
                    await settings.save();
                }

                if (task.optionalDueDate) {
                    const dueDate = new Date(task.optionalDueDate);
                    const notificationDate = new Date(dueDate);
                    notificationDate.setDate(dueDate.getDate() - settings.dueDateNotificationDays);

                    if (notificationDate <= new Date()) {
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
        let tasks = classInfo.tasks || [];

        // Separate tasks into incomplete and complete
        const incompleteTasks = tasks.filter(task =>
            task.completions.some(c => c.student.toString() === userId.toString() && !c.completed)
        );

        const completeTasks = tasks.filter(task =>
            task.completions.some(c => c.student.toString() === userId.toString() && c.completed)
        );

        // Sort incomplete tasks by importance and due date
        incompleteTasks.sort((a, b) => {
            // Sort by importance first (high > medium > low)
            const importanceOrder = { 'high': 1, 'medium': 2, 'low': 3 };
            if (importanceOrder[a.importance] !== importanceOrder[b.importance]) {
                return importanceOrder[a.importance] - importanceOrder[b.importance];
            }
            // Then sort by due date (earliest first)
            const aDueDate = a.optionalDueDate ? new Date(a.optionalDueDate) : new Date(8640000000000000);
            const bDueDate = b.optionalDueDate ? new Date(b.optionalDueDate) : new Date(8640000000000000);
            return aDueDate - bDueDate;
        });

        // Combine incomplete tasks followed by complete tasks
        tasks = [...incompleteTasks, ...completeTasks];

        const { totalAttendancePercentage, studentAttendancePercentage } = await calculateClassAttendance(classId, userId);

        res.render('student-class-details', {
            className: classInfo.name,
            classId: classId,
            totalAttendancePercentage: totalAttendancePercentage.toFixed(2),
            studentAttendancePercentage: studentAttendancePercentage.toFixed(2),
            tasks: tasks,
            userId: userId,
            req: req // Pass req to the template
        });
    } catch (error) {
        console.error('Error retrieving class and task details for student:', error);
        res.status(500).send('Failed to retrieve class and task details');
    }
});


router.get('/student-incomplete-tasks', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId;
        const tasks = await Task.find({
            completions: {
                $elemMatch: {
                    student: userId,
                    completed: false
                }
            }
        }).populate({
            path: 'class',
            select: 'name' // Only fetch the class name
        });
        

        // Mark new tasks as read
        const result = await Task.updateMany(
            { "completions.student": userId, "completions.completed": false, "completions.new": true },
            { $set: { "completions.$[elem].new": false } },
            { arrayFilters: [{ "elem.student": userId }] }
        );

       

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

        

        res.render('student-incomplete-tasks', {
            newTasks: newTasks,
            otherTasks: otherTasks,
            userId: userId,
            req: req // Pass req to the template
        });
    } catch (error) {
        console.error('Error retrieving incomplete tasks:', error);
        res.status(500).send('Failed to retrieve incomplete tasks');
    }
});










router.post('/mark-tasks-complete', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { completedTasks, returnUrl } = req.body;

        if (!completedTasks) {
            return res.redirect(returnUrl || '/students/student-incomplete-tasks');
        }

        const taskIds = Array.isArray(completedTasks) ? completedTasks : [completedTasks];

        await Promise.all(taskIds.map(async taskId => {
            await Task.updateOne(
                { _id: taskId, "completions.student": userId },
                { $set: { "completions.$.completed": true, "completions.$.new": false } }
            );
        }));

        return res.redirect(returnUrl || '/students/student-incomplete-tasks');
    } catch (error) {
        console.error('Error marking tasks as complete:', error);
        res.status(500).send('Failed to mark tasks as complete');
    }
});

router.get('/student-new-tasks', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Fetch new tasks for the student using $elemMatch
        const tasks = await Task.find({
            completions: {
                $elemMatch: {
                    student: userId,
                    completed: false,
                    new: true
                }
            }
        }).populate('class', 'name');
        
        console.log('New tasks for student:', tasks);

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
        let notifications = await Notification.find({ user: userId, read: false });
        notifications = notifications.reverse(); // Reverse to show the most recent ones first if needed
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

        res.render('student-settings', { settings, message: null, messageType: null });
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).send('Failed to load settings');
    }
});

// Update settings
// Update settings
router.post('/settings', verifyStudent, [
    body('attendanceThreshold')
        .isInt({ min: 0, max: 100 }).withMessage('Attendance threshold must be an integer between 0 and 100'),
    body('dueDateNotificationDays')
        .isInt({ min: 0 }).withMessage('Due date notification days must be a non-negative integer')
], async (req, res) => {
    const errors = validationResult(req);
    const userId = req.session.userId;
    let settings = await UserSettings.findOne({ user: userId });
    if (!settings) {
        settings = new UserSettings({ user: userId });
        await settings.save();
    }

    if (!errors.isEmpty()) {
        return res.render('student-settings', {
            settings,
            message: errors.array().map(error => error.msg).join(', '),
            messageType: 'error'
        });
    }

    try {
        const { attendanceThreshold, dueDateNotificationDays } = req.body;

        await UserSettings.findOneAndUpdate(
            { user: userId },
            { attendanceThreshold, dueDateNotificationDays },
            { upsert: true, new: true }
        );

        res.render('student-settings', {
            settings,
            message: 'Settings updated successfully.',
            messageType: 'success'
        });
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

router.get('/student-new-notifications', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Fetch new notifications for the student
        const notifications = await Notification.find({
            user: userId,
            new: true
        });

        res.json({ notifications: notifications });
    } catch (error) {
        console.error('Error retrieving new notifications:', error);
        res.status(500).send('Failed to retrieve new notifications');
    }
});

router.post('/mark-notifications-not-new', verifyStudent, async (req, res) => {
    try {
        const userId = req.session.userId; // Derive userId from session for security
        await Notification.updateMany(
            { user: userId, new: true },
            { $set: { new: false } }
        );
        res.status(200).json({ message: 'Notifications marked as not new' });
    } catch (error) {
        console.error('Error marking notifications as not new:', error);
        res.status(500).json({ message: 'Failed to mark notifications as not new' });
    }
});

// Change password
router.post('/change-password', verifyStudent, [
    body('oldPassword')
        .notEmpty().withMessage('Old password is required'),
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
    const userId = req.session.userId;
    const settings = await UserSettings.findOne({ user: userId });

    if (!errors.isEmpty()) {
        return res.render('student-settings', {
            settings,
            message: errors.array().map(error => error.msg).join(', '),
            messageType: 'error'
        });
    }

    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        const result = await changeUserPassword(userId, oldPassword, newPassword, confirmPassword);

        if (result.success) {
            res.render('student-settings', { settings, message: result.message, messageType: 'success' });
        } else {
            res.render('student-settings', { settings, message: result.message, messageType: 'error' });
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).send('Failed to load settings');
    }
});



router.get('/student-attendance-report', verifyStudent, async (req, res) => {
    const userId = req.session.userId;

    try {
        const attendanceRecords = await Attendance.find({ "records.student": userId }).exec();
        const totalSessions = attendanceRecords.length;
        const totalPresent = attendanceRecords.reduce((acc, record) => {
            const studentRecord = record.records.find(r => r.student.toString() === userId.toString());
            return acc + (studentRecord.status === 'Present' ? 1 : 0);
        }, 0);

        const averageAttendancePercentage = totalSessions > 0 ? (totalPresent / totalSessions) * 100 : 0;

        res.render('student-attendance-report', {
            attendanceRecords,
            averageAttendancePercentage: averageAttendancePercentage.toFixed(2),
        });
    } catch (error) {
        console.error('Error retrieving attendance report:', error);
        res.status(500).send('Failed to retrieve attendance report');
    }
});

router.get('/student-attendance-data', verifyStudent, async (req, res) => {
    const userId = req.session.userId;

    try {
        const attendanceRecords = await Attendance.find({ "records.student": userId }).sort({ date: 1 }).exec();
        let totalSessions = 0;
        let totalPresent = 0;

        const processedData = attendanceRecords.map(record => {
            totalSessions += 1;
            const studentRecord = record.records.find(r => r.student.toString() === userId.toString());
            if (studentRecord.status === 'Present') {
                totalPresent += 1;
            }
            const cumulativePercentage = (totalPresent / totalSessions) * 100;
            return { date: record.date.toISOString().split('T')[0], cumulativePercentage };
        });

        res.json(processedData);
    } catch (error) {
        console.error('Error retrieving attendance data:', error);
        res.status(500).json({ error: 'Failed to retrieve attendance data' });
    }
});

router.get('/class-attendance-report/:classId', verifyStudent, async (req, res) => {
    const userId = req.session.userId;
    const classId = req.params.classId;

    try {
        const { totalAttendancePercentage, studentAttendancePercentage } = await calculateClassAttendance(classId, userId);

        res.render('class-attendance-report', {
            classId,
            totalAttendancePercentage: totalAttendancePercentage.toFixed(2),
            studentAttendancePercentage: studentAttendancePercentage.toFixed(2),
        });
    } catch (error) {
        console.error('Error retrieving class attendance report:', error);
        res.status(500).send('Failed to retrieve class attendance report');
    }
});

router.get('/class-attendance-data/:classId', verifyStudent, async (req, res) => {
    const classId = req.params.classId;
    const userId = req.session.userId;
    console.log("Fetching attendance data for class:", classId, "and student:", userId);

    try {
        const attendanceRecords = await Attendance.find({ class: classId }).sort({ date: 1 }).exec();
        let totalSessions = 0;
        let totalPresent = 0;

        const processedData = attendanceRecords.map(record => {
            totalSessions += 1;
            const studentRecord = record.records.find(r => r.student.toString() === userId.toString());
            if (studentRecord && studentRecord.status === 'Present') {
                totalPresent += 1;
            }
            const cumulativePercentage = (totalPresent / totalSessions) * 100;
            return { date: record.date.toISOString().split('T')[0], cumulativePercentage };
        });
        console.log('Processed Attendance Data:', processedData); 

        res.json(processedData);
    } catch (error) {
        console.error('Error retrieving class attendance data:', error);
        res.status(500).json({ error: 'Failed to retrieve class attendance data' });
    }
});


module.exports = router;
