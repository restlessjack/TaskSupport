// attendanceUtils.js
const Attendance = require('../models/attendance');

async function calculateAttendance(classId) {
    const attendanceRecords = await Attendance.find({ class: classId });
    let totalPresent = 0;
    let totalRecords = 0;
    const studentAttendance = {};

    attendanceRecords.forEach(record => {
        record.records.forEach(individualRecord => {
            totalRecords++;
            if (individualRecord.status === 'Present') {
                totalPresent++;
            }
            if (!studentAttendance[individualRecord.student]) {
                studentAttendance[individualRecord.student] = { present: 0, total: 0 };
            }
            studentAttendance[individualRecord.student].total++;
            if (individualRecord.status === 'Present') {
                studentAttendance[individualRecord.student].present++;
            }
        });
    });

    const totalAttendancePercentage = totalRecords > 0 ? (totalPresent / totalRecords) * 100 : 0;
    return { totalAttendancePercentage, studentAttendance };
}

module.exports = {
    calculateAttendance
};
