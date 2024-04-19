const express = require('express');
const router = express.Router();

// Home page route
router.get('/', (req, res) => {
    res.send('Welcome to the Task Management System!');
});

// Register page route
router.get('/register', (req, res) => {
    res.render('register');
});

// Login page route
router.get('/login', (req, res) => {
    res.render('login');
});

module.exports = router;
