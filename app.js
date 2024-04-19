const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const indexRoutes = require('./routes/index');  // General or home page routes
const userRoutes = require('./routes/users');  // User-specific routes

const teacherRoutes = require('./routes/teachers');  // User-specific routes
const studentRoutes = require('./routes/students'); // Import the class router
const classRoutes = require('./routes/classes');  // Adjust the path according to your file structure


const session = require('express-session');
const MongoStore = require('connect-mongo');

// Database URI
const mongoDbUrl = 'mongodb://localhost:27017/mydatabase';



const app = express();
const path = require('path');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const port = process.env.PORT || 3000;

// Database connection
mongoose.connect(mongoDbUrl, {
    
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: mongoDbUrl,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Setup routes
app.use('/', indexRoutes);  // Home and general routes
app.use('/users', userRoutes);  // User specific routes
// Use the class router for any requests to '/classes'

app.use('/students', studentRoutes);
app.use('/teachers', teacherRoutes);
app.use('/classes', classRoutes);  // This mounts your router on '/classes'

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
