const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.send('Welcome to the Task Management System!');
});

// Import user routes
const userRoutes = require('./users');

// Use user routes for '/users' endpoints
router.use('/users', userRoutes);


// Define a route handler for the '/register' endpointA
router.get('/register', (req, res) => {
    res.render('register'); // Render the register page
});
// Define a route handler for the '/login' endpoint
router.get('/login', (req, res) => {
    res.render('login'); // Render the login page
});





module.exports = router;
