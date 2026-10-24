const express = require('express');
const router = express.Router();
const { Student, Course, User, Attendance, Marks } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// GET /api/dashboard/stats - Dynamic role-based dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().substring(0, 10);
    const role = req.user.role;

    // 1. ADMIN DASHBOARD STATS
    if (role === 'admin') {
      const totalStudents = await Student.countDocuments({ status: 'active' });
      const totalCourses = await Course.countDocuments();
      const totalTeachers = await User.countDocuments({ role: 'teacher', status: 'active' });

      // Today's attendance summary
      const todayAttendance = await Attendance.find({ date: todayStr });
      const todayPresent = todayAttendance.filter(a => a.status === 'Present').length;
      const todayAbsent = todayAttendance.filter(a => a.status === 'Absent').length;
      const todayTotal = todayAttendance.length;
      const todayPercentage = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 1000) / 10 : 0;

      // Institute average marks
      const allMarks = await Marks.find();
      let totalObtained = 0;
      let totalMax = 0;
      allMarks.forEach(m => {
        totalObtained += m.obtainedMarks || 0;
        totalMax += m.maxMarks || 0;
      });
      const avgMarksPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;

      // Recent attendance and marks activity
      const recentAttendance = await Attendance.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('studentId', 'name rollNumber')
        .populate('courseId', 'code name');

      const recentMarks = await Marks.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('studentId', 'name rollNumber')
        .populate('courseId', 'code name');

      return res.json({
        success: true,
        role: 'admin',
        stats: {
          totalStudents,
          totalCourses,
          totalTeachers,
          todayAttendance: {
            date: todayStr,
            totalMarked: todayTotal,
            present: todayPresent,
            absent: todayAbsent,
            percentage: todayPercentage
          },
          averageMarksPercentage: avgMarksPct,
          recentAttendance,
          recentMarks
        }
      });
    }

    // 2. TEACHER DASHBOARD STATS
    if (role === 'teacher') {
      const myCourses = await Course.find({ teacherId: req.user._id });
      const courseIds = myCourses.map(c => String(c._id));

      // Calculate total students across assigned courses
      const semesters = [...new Set(myCourses.map(c => c.semester))];
      let myStudentsCount = 0;
      if (semesters.length > 0) {
        myStudentsCount = await Student.countDocuments({ semester: { $in: semesters }, status: 'active' });
      }

      // Check which courses have attendance marked for today
      const todayAttendance = await Attendance.find({
        date: todayStr,
        courseId: { $in: courseIds }
      });

      const markedCourseIds = new Set(todayAttendance.map(a => String(a.courseId._id || a.courseId)));

      const courseStatusList = myCourses.map(c => {
        const isMarked = markedCourseIds.has(String(c._id));
        return {
          id: String(c._id),
          name: c.name,
          code: c.code,
          semester: c.semester,
          todayAttendanceMarked: isMarked
        };
      });

      const pendingAttendanceCount = myCourses.filter(c => !markedCourseIds.has(String(c._id))).length;

      return res.json({
        success: true,
        role: 'teacher',
        stats: {
          assignedCoursesCount: myCourses.length,
          totalStudents: myStudentsCount,
          pendingAttendanceToday: pendingAttendanceCount,
          todayStr,
          courses: courseStatusList
        }
      });
    }

    // 3. STUDENT DASHBOARD STATS
    if (role === 'student') {
      const studentId = req.user.linkedStudentId;
      if (!studentId) {
        return res.json({
          success: true,
          role: 'student',
          stats: { message: 'No student profile is currently linked to this user.' }
        });
      }

      const student = await Student.findById(studentId);
      const enrolledCourses = await Course.find({ semester: student.semester });

      // Attendance summary
      const attendanceRecords = await Attendance.find({ studentId }).populate('courseId');
      const totalClasses = attendanceRecords.length;
      const attended = attendanceRecords.filter(a => a.status === 'Present').length;
      const attendancePercentage = totalClasses > 0 ? Math.round((attended / totalClasses) * 1000) / 10 : 0;
      const isLowAttendance = attendancePercentage < 75;

      // Marks summary
      const marksRecords = await Marks.find({ studentId }).populate('courseId');
      let totalObtained = 0;
      let totalMax = 0;
      marksRecords.forEach(m => {
        totalObtained += m.obtainedMarks;
        totalMax += m.maxMarks;
      });
      const marksPercentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;

      return res.json({
        success: true,
        role: 'student',
        stats: {
          student,
          enrolledCoursesCount: enrolledCourses.length,
          attendance: {
            totalClasses,
            attended,
            percentage: attendancePercentage,
            isLowAttendance
          },
          marks: {
            totalObtained,
            totalMax,
            percentage: marksPercentage,
            recordsCount: marksRecords.length
          },
          recentMarks: marksRecords.slice(0, 5)
        }
      });
    }

    res.status(400).json({ success: false, message: 'Invalid role.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

