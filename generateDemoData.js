const mongoose = require('mongoose');
const User = require('./models/user'); // Adjust the path as necessary
const Class = require('./models/class'); // Adjust the path as necessary
const Attendance = require('./models/attendance'); // Adjust the path as necessary
const Task = require('./models/task'); // Adjust the path as necessary

mongoose.connect('mongodb://localhost:27017/mydatabase_demo', { useNewUrlParser: true, useUnifiedTopology: true });

const generateRandomUsername = () => {
    const firstNames = [
        'Alex', 'Jamie', 'Sam', 'Taylor', 'Jordan', 'Chris', 'Morgan', 'Drew', 'Casey', 'Avery',
        'Pat', 'Robin', 'Jesse', 'Kelly', 'Lee', 'Riley', 'Skyler', 'Emerson', 'Dakota', 'Reese',
        'Quinn', 'Sawyer', 'Peyton', 'Ariel', 'Charlie', 'Blake', 'River', 'Shawn', 'Terry', 'Jamie',
        'Cameron', 'Dana', 'Rowan', 'Sydney', 'Harper', 'Frankie', 'Kai', 'Alexis', 'Hunter', 'Parker',
        'Jordan', 'Bailey', 'Sage', 'Blair', 'Devon', 'Tatum', 'Hayden', 'Cory', 'Jules', 'Reagan',
        'Sky', 'Mickey', 'Ashton', 'Dallas', 'Remy', 'Toni', 'Lennon', 'Elliott'
    ];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const number = Math.floor(Math.random() * 90) + 10; // random 2 digit number
    return `${firstName}${number}`;
};

const generateRandomAttendance = (attendanceLikelihood) => {
    return Math.random() < attendanceLikelihood ? 'Present' : 'Absent';
};

const generateTasks = async (classId, students) => {
    const tasks = [
        { description: 'Complete Chapter 1 Homework', importance: 'high', optionalDueDate: new Date() },
        { description: 'Prepare for Midterm Exam', importance: 'medium', optionalDueDate: new Date(new Date().setDate(new Date().getDate() + 7)) },
        { description: 'Submit Lab Report', importance: 'low', optionalDueDate: new Date(new Date().setDate(new Date().getDate() + 14)) },
        { description: 'Read Chapter 2', importance: 'high', optionalDueDate: new Date(new Date().setDate(new Date().getDate() + 21)) },
        { description: 'Group Project Part 1', importance: 'medium', optionalDueDate: new Date(new Date().setDate(new Date().getDate() + 28)) },
        { description: 'Final Exam Preparation', importance: 'high', optionalDueDate: new Date(new Date().setDate(new Date().getDate() + 35)) }
    ];

    for (let taskData of tasks) {
        const task = new Task({
            description: taskData.description,
            class: classId,
            completions: students.map(student => ({
                student: student._id,
                completed: false
            })),
            importance: taskData.importance,
            optionalDueDate: taskData.optionalDueDate,
            moreInfo: 'Additional information about the task.'
        });
        await task.save();
        await Class.findByIdAndUpdate(classId, { $push: { tasks: task._id } });
        console.log('Task created:', task);
    }
};

const generateAttendance = async (classId, students, numDays, attendanceLikelihood) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - numDays); // start from numDays ago

    for (let i = 0; i < numDays; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const records = students.map(student => ({
            student: student._id,
            status: generateRandomAttendance(attendanceLikelihood)
        }));

        const attendanceRecord = new Attendance({
            class: classId,
            date: date,
            records: records
        });
        await attendanceRecord.save();
        await Class.findByIdAndUpdate(classId, { $push: { attendanceRecords: attendanceRecord._id } });
        console.log('Attendance record created for date:', date);
    }
};

const generateClassData = async (numStudentsPerClass, numDays, attendanceLikelihood) => {
    try {
        // Create a common student
        const studentUsername = generateRandomUsername();
        const student = new User({
            username: studentUsername,
            password: 'pass',
            role: 'student'
        });
        await student.save();
        console.log('Student created:', student);

        // Create a main teacher
        const teacherUsername = generateRandomUsername();
        const teacher = new User({
            username: teacherUsername,
            password: 'pass',
            role: 'teacher'
        });
        await teacher.save();
        console.log('Teacher created:', teacher);

        // Create additional teachers
        const additionalTeacher1 = new User({
            username: generateRandomUsername(),
            password: 'pass',
            role: 'teacher'
        });
        await additionalTeacher1.save();

        const additionalTeacher2 = new User({
            username: generateRandomUsername(),
            password: 'pass',
            role: 'teacher'
        });
        await additionalTeacher2.save();

        console.log('Additional teachers created:', additionalTeacher1.username, additionalTeacher2.username);

        // Output the usernames of the main teacher and student
        console.log(`Main Teacher Username: ${teacherUsername}`);
        console.log(`Main Student Username: ${studentUsername}`);

        // Helper function to create additional students
        const createAdditionalStudents = async (numStudents, excludeStudent) => {
            const students = excludeStudent ? [] : [student];
            for (let i = 0; i < numStudents - (excludeStudent ? 0 : 1); i++) {
                const username = generateRandomUsername();
                const additionalStudent = new User({
                    username: username,
                    password: 'pass',
                    role: 'student'
                });
                await additionalStudent.save();
                students.push(additionalStudent);
                console.log('Additional student created:', additionalStudent);
            }
            return students;
        };

        // Create classes for the student
        const studentClasses = [
            { name: 'Physics 101', teacher: additionalTeacher1._id },
            { name: 'Math 101', teacher: additionalTeacher2._id },
            { name: 'Chemistry 101', teacher: teacher._id }
        ];
        for (const classInfo of studentClasses) {
            const students = await createAdditionalStudents(numStudentsPerClass, false);
            const classInstance = new Class({
                name: classInfo.name,
                teacher: classInfo.teacher,
                students: students.map(student => student._id)
            });
            await classInstance.save();
            await generateAttendance(classInstance._id, students, numDays, attendanceLikelihood);
            await generateTasks(classInstance._id, students);
            console.log(`Class created for student: ${classInfo.name}`);
        }

        // Create classes for the main teacher without the main student
        const teacherClasses = ['Biology 101', 'History 101'];
        for (const className of teacherClasses) {
            const students = await createAdditionalStudents(numStudentsPerClass, true);
            const classInstance = new Class({
                name: className,
                teacher: teacher._id,
                students: students
            });
            await classInstance.save();
            await generateAttendance(classInstance._id, students, numDays, attendanceLikelihood);
            await generateTasks(classInstance._id, students);
            console.log(`Class created for teacher: ${className}`);
        }

        console.log(`Main Teacher Username: ${teacherUsername}`);
        console.log(`Main Student Username: ${studentUsername}`);
    } catch (error) {
        console.error('Error generating class data:', error);
    } finally {
        mongoose.connection.close();
    }
};

// Parameters: number of students per class, number of days, attendance likelihood (0 to 1)
generateClassData(10, 21, 0.75);
