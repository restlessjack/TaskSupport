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
    const capitalLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Random capital letter A-Z
    const number = Math.floor(Math.random() * 90) + 10; // Random 2-digit number
    return `${firstName}${capitalLetter}${number}`;
};

const generateRandomAttendance = (attendanceLikelihood) => {
    return Math.random() < attendanceLikelihood ? 'Present' : 'Absent';
};

const generateTasks = async (classId, subject, students) => {
    const taskTemplates = {
        'Physics 101': [
            { 'description': 'Complete Chapter 1 Problems', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Prepare for Midterm Exam', 'importance': 'medium', 'extraInfo': false, 'dueDate': true },
            { 'description': 'Submit Lab Report on Kinematics', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Read Chapter 2: Forces', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Group Project: Newton\'s Laws Presentation', 'importance': 'medium', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Final Exam Preparation', 'importance': 'high', 'extraInfo': false, 'dueDate': true },
            { 'description': 'Practice Problems for Chapter 3', 'importance': 'medium', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Watch Lecture on Electromagnetism', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Review Past Midterms', 'importance': 'high', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Participate in Physics Study Group', 'importance': 'medium', 'extraInfo': true, 'dueDate': false },
            { 'description': 'Write Summary for Chapter 4', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Complete Online Quiz for Chapter 5', 'importance': 'medium', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Conduct Experiment on Wave Properties', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Read Research Paper on Quantum Mechanics', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Attend Physics Seminar', 'importance': 'medium', 'extraInfo': false, 'dueDate': false }
        ],
        'Math 101': [
            { 'description': 'Complete Algebra Homework', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Study for Midterm Exam', 'importance': 'medium', 'extraInfo': false, 'dueDate': true },
            { 'description': 'Submit Geometry Assignment', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Read Chapter on Calculus', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Group Project: Statistics Survey', 'importance': 'medium', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Final Exam Preparation', 'importance': 'high', 'extraInfo': false, 'dueDate': true },
            { 'description': 'Practice Problems for Trigonometry', 'importance': 'medium', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Watch Video on Differential Equations', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Review Past Quizzes', 'importance': 'high', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Participate in Math Study Group', 'importance': 'medium', 'extraInfo': true, 'dueDate': false },
            { 'description': 'Write Summary for Probability Chapter', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Complete Online Quiz for Matrices', 'importance': 'medium', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Conduct Experiment on Geometry Theorems', 'importance': 'high', 'extraInfo': true, 'dueDate': true }
        ],
        'Chemistry 101': [
            { 'description': 'Complete Mole Concept Problems', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Prepare for Midterm Exam', 'importance': 'medium', 'extraInfo': false, 'dueDate': true },
            { 'description': 'Submit Lab Report on Acid-Base Titration', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Read Chapter on Thermodynamics', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Group Project: Organic Chemistry Reactions', 'importance': 'medium', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Final Exam Preparation', 'importance': 'high', 'extraInfo': false, 'dueDate': true },
            { 'description': 'Practice Problems for Chemical Bonding', 'importance': 'medium', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Watch Lecture on Atomic Structure', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Review Past Lab Reports', 'importance': 'high', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Participate in Chemistry Study Group', 'importance': 'medium', 'extraInfo': true, 'dueDate': false },
            { 'description': 'Write Summary for Solutions Chapter', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Complete Online Quiz for Kinetics', 'importance': 'medium', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Conduct Experiment on Electrochemistry', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Read Research Paper on Polymers', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Attend Chemistry Seminar', 'importance': 'medium', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Create Mind Map for Periodic Table Trends', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Solve Additional Exercises for Thermodynamics', 'importance': 'medium', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Prepare Flashcards for Key Reactions', 'importance': 'high', 'extraInfo': false, 'dueDate': false }
        ],
        'Biology 101': [
            { 'description': 'Complete Cell Biology Worksheet', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Study for Midterm Exam', 'importance': 'medium', 'extraInfo': false, 'dueDate': true },
            { 'description': 'Submit Lab Report on Photosynthesis', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Read Chapter on Genetics', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Group Project: Human Anatomy Presentation', 'importance': 'medium', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Final Exam Preparation', 'importance': 'high', 'extraInfo': false, 'dueDate': true },
            { 'description': 'Practice Problems for Ecology', 'importance': 'medium', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Watch Documentary on Evolution', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Review Past Exams', 'importance': 'high', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Participate in Biology Study Group', 'importance': 'medium', 'extraInfo': true, 'dueDate': false },
            { 'description': 'Write Summary for Molecular Biology Chapter', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Complete Online Quiz for Plant Physiology', 'importance': 'medium', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Conduct Experiment on Enzyme Activity', 'importance': 'high', 'extraInfo': true, 'dueDate': true }
        ],
        'History 101': [
            { 'description': 'Complete Ancient Civilizations Assignment', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Prepare for Midterm Exam', 'importance': 'medium', 'extraInfo': false, 'dueDate': true },
            { 'description': 'Submit Essay on World War II', 'importance': 'high', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Read Chapter on Medieval Europe', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Group Project: Renaissance Art Analysis', 'importance': 'medium', 'extraInfo': true, 'dueDate': true },
            { 'description': 'Final Exam Preparation', 'importance': 'high', 'extraInfo': false, 'dueDate': true },
            { 'description': 'Practice Essay for American Revolution', 'importance': 'medium', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Watch Documentary on Roman Empire', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Review Past Essays', 'importance': 'high', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Participate in History Study Group', 'importance': 'medium', 'extraInfo': true, 'dueDate': false },
            { 'description': 'Write Summary for Industrial Revolution Chapter', 'importance': 'low', 'extraInfo': false, 'dueDate': false },
            { 'description': 'Complete Online Quiz for Cold War', 'importance': 'medium', 'extraInfo': true, 'dueDate': true }
        ]
    }
    ;

    const tasks = taskTemplates[subject];
    const today = new Date();

    for (let taskData of tasks) {
        const optionalDueDate = taskData.dueDate ? new Date(today.getTime() + Math.floor(Math.random() * 14 + 1) * 24 * 60 * 60 * 1000) : null;
        const extraInfo = taskData.extraInfo ? 'Additional information about the task.' : '';
        const task = new Task({
            description: taskData.description,
            class: classId,
            completions: students.map(student => ({
                student: student._id,
                completed: false
            })),
            importance: taskData.importance,
            optionalDueDate: optionalDueDate,
            moreInfo: extraInfo
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
            await generateTasks(classInstance._id, classInfo.name, students);
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
            await generateTasks(classInstance._id, className, students);
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
