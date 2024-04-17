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
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Check if user exists
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).send('User not found');
        }

        // Compare the provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send(user.password);
        }

        // Redirect to different pages based on the user role
        if (user.role === 'teacher') {
            res.redirect('/teacher-dashboard'); // Assuming you have a route for teacher dashboard
        } else if (user.role === 'student') {
            res.redirect('/student-dashboard'); // Assuming you have a route for student dashboard
        }
    } catch (error) {
        res.status(500).send('Error logging in user.');
    }
});



module.exports = router;
