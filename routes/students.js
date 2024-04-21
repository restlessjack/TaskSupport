const express = require('express');
const router = express.Router();

function verifyStudent(req, res, next) {
    if (!req.session.userId || req.session.userRole !== 'student') {
        return res.status(403).send('Access denied. Students only.');
    }
    next();
}

router.get('/student-dashboard', verifyStudent, async (req, res) => {
    try {
        
       

        res.render('student-dashboard', {
            username: req.session.username,
            
        });
    } catch (error) {
        console.error('Dashboard access error for student:', error);
        res.status(500).send('Failed to load student dashboard');
    }
});


module.exports = router;