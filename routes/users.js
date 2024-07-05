const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// Registration route
// Registration route
router.post('/register', [
    body('username')
        .trim()
        .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long')
        .escape(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/\d/).withMessage('Password must contain a number')
        .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
        .matches(/[!@#$%^&*]/).withMessage('Password must contain a special character')
        .escape(),
    body('role')
        .isIn(['teacher', 'student']).withMessage('Role must be either teacher or student')
], async (req, res) => {
    const { username, password, role } = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('register', {
            message: errors.array().map(error => error.msg).join(', '),
            messageType: 'error'
        });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.render('register', { message: 'User already exists', messageType: 'error' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            username,
            password: hashedPassword,
            role
        });
        await user.save();
        res.redirect('/login');
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).render('register', { message: 'Error registering new user.', messageType: 'error' });
    }
});

// Render the register page with default values
router.get('/register', (req, res) => {
    res.render('register', { message: '', messageType: '' });
});
// Login route
router.post('/login', [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required')
        .escape(),
    body('password')
        .notEmpty().withMessage('Password is required')
        .escape()
], async (req, res) => {
    const { username, password } = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.render('login', { message: 'User not found', messageType: 'error' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { message: 'Invalid Credentials', messageType: 'error' });
        }

        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.userRole = user.role;

        // Redirect based on role
        if (user.role === 'teacher') {
            res.redirect('/teachers/dashboard');
        } else if (user.role === 'student') {
            res.redirect('/students/student-dashboard');
        }
    } catch (error) {
        res.status(500).render('login', { message: 'Error logging in user.', messageType: 'error' });
    }
});

// Render the login page with default values
router.get('/login', (req, res) => {
    res.render('login', { message: '', messageType: '' });
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/'); // redirect to home page if there's an error
        }

        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect('/login'); // Redirect to the login page
    });
});

module.exports = router;
