const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    description: { type: String, required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    completions: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        completed: { type: Boolean, default: false }
    }]
}, { timestamps: { createdAt: 'date', updatedAt: 'updatedAt' } }); // Use MongoDB's built-in timestamp functionality

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;
