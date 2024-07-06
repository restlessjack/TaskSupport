const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    description: { type: String, required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    completions: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        completed: { type: Boolean, default: false },
        new: { type: Boolean, default: true }
    }],
    importance: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }, // Add importance field
    optionalDueDate: { type: Date }, // Add optional due date field
    moreInfo: { type: String } // Add more info field
}, { timestamps: { createdAt: 'date', updatedAt: 'updatedAt' } });

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;
