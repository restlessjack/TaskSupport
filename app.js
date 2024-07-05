const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

const indexRoutes = require('./routes/index');  // General or home page routes
const userRoutes = require('./routes/users');  // User-specific routes
const teacherRoutes = require('./routes/teachers');  // Teacher-specific routes
const studentRoutes = require('./routes/students');  // Student-specific routes
const attendanceRoutes = require('./routes/attendances');  // Attendance-specific routes

const mongoDbUrl = 'mongodb://localhost:27017/mydatabase';
const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

mongoose.connect(mongoDbUrl, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoDbUrl, collectionName: 'sessions' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.locals.userRole = req.session.userRole;
    next();
});

// Setup routes
app.use('/', indexRoutes);  // Home and general routes
app.use('/users', userRoutes);  // User specific routes
app.use('/students', studentRoutes);  // Student specific routes
app.use('/teachers', teacherRoutes);  // Teacher specific routes
app.use('/attendances', attendanceRoutes);  // Attendance specific routes

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
