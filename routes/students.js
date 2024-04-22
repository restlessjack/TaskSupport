
const express = require('express');
const router = express.Router();
const Class = require('../models/class');
const Attendance = require('../models/attendance');
const mongoose = require('mongoose');

function verifyStudent(req, res, next) {
    if (!req.session.userId || req.session.userRole !== 'student') {
        return res.status(403).send('Access denied. Students only.');
    }
    next();
}

router.get('/student-dashboard', verifyStudent, async (req, res) => {
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

        res.render('student-dashboard', {
            username: req.session.username,
            
            totalAttendancePercentage: totalAttendancePercentage.toFixed(2) // Formatting to 2 decimal places
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
        const userId = new mongoose.Types.ObjectId(req.session.userId);
        
        // Calculate the attendance percentage for the specific class
        const results = await Attendance.aggregate([
            { $match: { class: classId, "records.student": userId } },
            { $unwind: "$records" },
            { $match: { "records.student": userId } },
            {
                $group: {
                    _id: null,
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

        res.render('student-class-details', {
            className: (await Class.findById(classId)).name,  // Fetching the class name
            totalAttendancePercentage: totalAttendancePercentage.toFixed(2)  // Formatting to 2 decimal places
        });
    } catch (error) {
        console.error('Error retrieving class attendance details for student:', error);
        res.status(500).send('Failed to retrieve class attendance details');
    }
});



module.exports = router;