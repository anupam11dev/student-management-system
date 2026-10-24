const express = require('express');
const router = express.Router();
const { Attendance, Course, Student } = require('../models');
const { authenticateToken, requireRole } = require('../middleware/auth');

// POST /api/attendance - Save or update attendance batch
// Allowed: Admin, Teacher (assigned)
router.post('/', authenticateToken, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { courseId, date, records } = req.body;

    if (!courseId || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Course ID, date, and attendance records array are required.'
      });
    }

    // Validate date format and ensure it is not in the future
    const selectedDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD.'
      });
    }

    if (selectedDate > today) {
      return res.status(400).json({
        success: false,
        message: 'Attendance date cannot be in the future.'
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    // Teacher assignment check
    if (req.user.role === 'teacher') {
      const assignedTeacherId = course.teacherId ? String(course.teacherId._id || course.teacherId) : null;
      if (assignedTeacherId && assignedTeacherId !== req.user._id) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. You are only authorized to mark attendance for courses assigned to you.'
        });
      }
    }

    const dateStr = String(date).substring(0, 10);
    const results = [];

    // Save or update each student's attendance record (Upsert)
    for (const record of records) {
      const { studentId, status, remarks } = record;
      if (!studentId || !['Present', 'Absent'].includes(status)) {
        continue;
      }

      await Attendance.updateOne(
        {
          studentId: String(studentId),
          courseId: String(courseId),
          date: dateStr
        },
        {
          $set: {
            studentId: String(studentId),
            courseId: String(courseId),
            date: dateStr,
            status,
            markedBy: req.user._id,
            remarks: remarks || ''
          }
        },
        { upsert: true }
      );

      results.push({ studentId, status });
    }

    res.json({
      success: true,
      message: `Attendance recorded for ${results.length} students on ${dateStr}.`,
      date: dateStr,
      courseId,
      totalMarked: results.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/attendance/check - Check if attendance was already recorded for course & date
// Allowed: Admin, Teacher
router.get('/check', authenticateToken, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { courseId, date } = req.query;
    if (!courseId || !date) {
      return res.status(400).json({ success: false, message: 'courseId and date are required' });
    }

    const records = await Attendance.find({
      courseId,
      date: String(date).substring(0, 10)
    });

    const studentMap = {};
    records.forEach(r => {
      const sId = String(r.studentId._id || r.studentId);
      studentMap[sId] = {
        status: r.status,
        remarks: r.remarks || ''
      };
    });

    res.json({
      success: true,
      hasRecords: records.length > 0,
      count: records.length,
      records: studentMap
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/attendance - Query attendance history with filters
// Allowed: All (Students limited to own records)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { courseId, studentId, date, startDate, endDate } = req.query;
    const filter = {};

    // If Student role, force studentId to their linked profile
    if (req.user.role === 'student') {
      if (!req.user.linkedStudentId) {
        return res.status(403).json({
          success: false,
          message: 'No student profile linked to your account.'
        });
      }
      filter.studentId = req.user.linkedStudentId;
    } else if (studentId) {
      filter.studentId = studentId;
    }

    if (courseId) {
      filter.courseId = courseId;
    }

    if (date) {
      filter.date = String(date).substring(0, 10);
    } else if (startDate || endDate) {
      if (startDate && endDate) {
        filter.date = { $gte: startDate, $lte: endDate };
      } else if (startDate) {
        filter.date = { $gte: startDate };
      } else if (endDate) {
        filter.date = { $lte: endDate };
      }
    }

    const records = await Attendance.find(filter)
      .populate('studentId', 'name rollNumber courseName semester')
      .populate('courseId', 'name code')
      .populate('markedBy', 'name email')
      .sort({ date: -1 });

    res.json({
      success: true,
      count: records.length,
      records
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/attendance/summary - Subject-wise & Student-wise statistics & percentage calculation
// Allowed: All (Students limited to own summary)
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    let targetStudentId = req.query.studentId;

    if (req.user.role === 'student') {
      targetStudentId = req.user.linkedStudentId;
      if (!targetStudentId) {
        return res.status(403).json({ success: false, message: 'No linked student found.' });
      }
    }

    const filter = {};
    if (targetStudentId) {
      filter.studentId = targetStudentId;
    }
    if (req.query.courseId) {
      filter.courseId = req.query.courseId;
    }

    const allRecords = await Attendance.find(filter)
      .populate('courseId', 'name code semester credits')
      .populate('studentId', 'name rollNumber semester');

    // Aggregate statistics
    // 1. Group by student and course
    const studentStats = {};

    for (const rec of allRecords) {
      const sId = String(rec.studentId._id || rec.studentId);
      const cId = String(rec.courseId._id || rec.courseId);
      const sName = rec.studentId.name || 'Unknown Student';
      const rollNumber = rec.studentId.rollNumber || 'N/A';
      const cName = rec.courseId.name || 'Unknown Course';
      const cCode = rec.courseId.code || 'N/A';

      if (!studentStats[sId]) {
        studentStats[sId] = {
          studentId: sId,
          name: sName,
          rollNumber,
          courses: {},
          totalClasses: 0,
          totalAttended: 0
        };
      }

      if (!studentStats[sId].courses[cId]) {
        studentStats[sId].courses[cId] = {
          courseId: cId,
          courseName: cName,
          courseCode: cCode,
          totalClasses: 0,
          attended: 0,
          absent: 0
        };
      }

      studentStats[sId].courses[cId].totalClasses += 1;
      studentStats[sId].totalClasses += 1;

      if (rec.status === 'Present') {
        studentStats[sId].courses[cId].attended += 1;
        studentStats[sId].totalAttended += 1;
      } else {
        studentStats[sId].courses[cId].absent += 1;
      }
    }

    // Calculate percentages
    const summaryList = Object.values(studentStats).map(student => {
      const courseList = Object.values(student.courses).map(c => {
        const pct = c.totalClasses > 0 ? (c.attended / c.totalClasses) * 100 : 0;
        return {
          ...c,
          percentage: Math.round(pct * 10) / 10,
          isLowAttendance: pct < 75
        };
      });

      const overallPct = student.totalClasses > 0
        ? (student.totalAttended / student.totalClasses) * 100
        : 0;

      return {
        studentId: student.studentId,
        name: student.name,
        rollNumber: student.rollNumber,
        totalClasses: student.totalClasses,
        totalAttended: student.totalAttended,
        overallPercentage: Math.round(overallPct * 10) / 10,
        isLowAttendance: overallPct < 75,
        courseBreakdown: courseList
      };
    });

    res.json({
      success: true,
      summary: targetStudentId ? (summaryList[0] || null) : summaryList
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

