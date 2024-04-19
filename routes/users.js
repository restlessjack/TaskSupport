const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcrypt = require('bcryptjs');

// Registration route
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).send('User already exists');
        }

        
        const user = new User({
            username,
            password,
            role
        });
        await user.save();
        res.redirect('/login');
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).send('Error registering new user.');
    }
});


// Login route
// Login route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).send('User not found');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid Credentials');
        }

        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.userRole = user.role;

        // Redirect based on role
        if (user.role === 'teacher') {
            res.redirect('/teachers/teacher-dashboard');
        } else if (user.role === 'student') {
            res.redirect('/student-dashboard');
        }
    } catch (error) {
        res.status(500).send('Error logging in user.');
    }
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
