const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/user'); // Adjust the path as necessary
const Class = require('./models/class'); // Adjust the path as necessary
const Attendance = require('./models/attendance'); // Adjust the path as necessary

mongoose.connect('mongodb://localhost:27017/mydatabase', { useNewUrlParser: true, useUnifiedTopology: true });

const firstNames = ['Alex', 'Jamie', 'Sam', 'Taylor', 'Jordan', 'Chris', 'Morgan', 'Drew', 'Casey', 'Avery'];
const adjectives = ['Cool', 'Smart', 'Bright', 'Dynamic', 'Energetic', 'Creative', 'Innovative', 'Brilliant', 'Sharp'];
const nouns = ['Class', 'Group', 'Team', 'Squad', 'Crew', 'Gang', 'Collective', 'Alliance', 'Cluster'];

const getRandomElement = (array) => {
    return array[Math.floor(Math.random() * array.length)];
};

const generateRandomUsername = () => {
    const firstName = getRandomElement(firstNames);
    const number = Math.floor(Math.random() * 90) + 10; // random 2 digit number
    return `${firstName}${number}`;
};

const generateRandomClassName = () => {
    const adjective = getRandomElement(adjectives);
    const noun = getRandomElement(nouns);
    return `${adjective} ${noun}`;
};

const generateRandomAttendance = (attendanceLikelihood) => {
    return Math.random() < attendanceLikelihood ? 'Present' : 'Absent';
};

const generateClassData = async (numStudents, numDays, attendanceLikelihood) => {
    try {
        // Create teacher
        const teacherUsername = generateRandomUsername();
        const teacher = new User({
            username: teacherUsername,
            password: 'pass',
            role: 'teacher'
        });
        await teacher.save();
        console.log('Teacher created:', teacher);

        // Create students
        const students = [];
        for (let i = 0; i < numStudents; i++) {
            const username = generateRandomUsername();
            const student = new User({
                username: username,
                password: 'pass',
                role: 'student'
            });
            students.push(student);
            await student.save();
            console.log('Student created:', student);
        }

        // Create class with a randomly generated name
        const className = generateRandomClassName();
        const classInfo = new Class({
            name: className,
            teacher: teacher._id,
            students: students.map(student => student._id)
        });
        await classInfo.save();
        console.log('Class created:', classInfo);

        // Generate attendance data
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - numDays); // start from numDays ago

        const attendanceData = [];

        for (let i = 0; i < numDays; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);

            const records = students.map(student => ({
                student: student._id,
                status: generateRandomAttendance(attendanceLikelihood)
            }));

            const attendanceRecord = new Attendance({
                class: classInfo._id,
                date: date,
                records: records
            });
            await attendanceRecord.save();
            attendanceData.push(attendanceRecord._id);
            console.log('Attendance record created for date:', date);
        }

        // Update class with attendance records
        classInfo.attendanceRecords = attendanceData;
        await classInfo.save();
        console.log('Class updated with attendance records');
    } catch (error) {
        console.error('Error generating class data:', error);
    } finally {
        mongoose.connection.close();
    }
};

// Parameters: number of students, number of days, attendance likelihood (0 to 1)
generateClassData(10, 21, 0.75);
