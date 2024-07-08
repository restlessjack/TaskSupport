// app.js
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

const indexRoutes = require('./routes/index');
const userRoutes = require('./routes/users');
const teacherRoutes = require('./routes/teachers');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendances');

const mongoDbUrl = 'mongodb://localhost:27017/mydatabase';
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

mongoose.connect(mongoDbUrl, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

app.use('/', indexRoutes);
app.use('/users', userRoutes);
app.use('/students', studentRoutes);
app.use('/teachers', teacherRoutes);
app.use('/attendances', attendanceRoutes);

module.exports = app;
