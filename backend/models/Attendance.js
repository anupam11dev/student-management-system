const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
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
  date: {
    type: String, // YYYY-MM-DD
    required: [true, 'Date is required']
  },
  status: {
    type: String,
    enum: ['Present', 'Absent'],
    required: [true, 'Status must be Present or Absent']
  },
  markedBy: {
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

attendanceSchema.index({ studentId: 1, courseId: 1, date: 1 }, { unique: true });

const AttendanceModel = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

module.exports = AttendanceModel;

