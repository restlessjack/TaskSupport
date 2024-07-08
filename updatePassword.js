const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/user'); // Adjust the path as necessary

const mongoDbUrl = 'mongodb://localhost:27017/mydatabase_demo'; // Your MongoDB URL

mongoose.connect(mongoDbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('Connected to MongoDB');

    const username = 'Harper62'; // Replace with the actual username
    const newPassword = 'pass'; // Replace with the new password

    try {
        const user = await User.findOne({ username });
        if (!user) {
            console.log('User not found');
            process.exit(1);
        }

        user.password = newPassword;
        await user.save();
        console.log('Password updated successfully');
    } catch (error) {
        console.error('Error updating password:', error);
    } finally {
        mongoose.connection.close();
    }
}).catch(error => {
    console.error('Error connecting to MongoDB:', error);
});
