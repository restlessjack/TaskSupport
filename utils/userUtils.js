const User = require('../models/user');
const bcrypt = require('bcryptjs');

const changeUserPassword = async (userId, oldPassword, newPassword, confirmPassword) => {
    

    if (newPassword !== confirmPassword) {
        return { success: false, message: "Passwords do not match" };
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            return { success: false, message: 'User not found' };
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return { success: false, message: 'Incorrect old password' };
        }

        user.password = newPassword;
        await user.save();

        return { success: true, message: "Password successfully changed" };
    } catch (error) {
        console.error('Error changing password:', error);
        return { success: false, message: 'Failed to change password' };
    }
};

module.exports = { changeUserPassword };
