const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student reference is required']
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course reference is required']
  },
  examType: {
    type: String,
    enum: ['Assignment', 'Internal', 'Semester'],
    required: [true, 'Exam type must be Assignment, Internal, or Semester']
  },
  obtainedMarks: {
    type: Number,
    required: [true, 'Obtained marks are required'],
    min: [0, 'Obtained marks cannot be negative']
  },
  maxMarks: {
    type: Number,
    required: [true, 'Max marks are required'],
    min: [1, 'Max marks must be greater than zero']
  },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  remarks: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

marksSchema.index({ studentId: 1, courseId: 1, examType: 1 }, { unique: true });

const MarksModel = mongoose.models.Marks || mongoose.model('Marks', marksSchema);

module.exports = MarksModel;

