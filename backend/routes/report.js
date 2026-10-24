const express = require('express');
const router = express.Router();
const { Student, Course, Attendance, Marks } = require('../models');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Helper to determine Grade
const getGrade = (percentage) => {
  if (percentage >= 90) return { grade: 'A+', points: 10, label: 'Outstanding' };
  if (percentage >= 80) return { grade: 'A', points: 9, label: 'Excellent' };
  if (percentage >= 70) return { grade: 'B+', points: 8, label: 'Very Good' };
  if (percentage >= 60) return { grade: 'B', points: 7, label: 'Good' };
  if (percentage >= 50) return { grade: 'C', points: 6, label: 'Average' };
  if (percentage >= 40) return { grade: 'D', points: 5, label: 'Pass' };
  return { grade: 'F', points: 0, label: 'Fail' };
};

// GET /api/reports/student/:id - Combined Student Summary Report (Profile + Attendance + Marks)
// Allowed: Admin, Teacher, own Student
router.get('/student/:id', authenticateToken, async (req, res) => {
  try {
    const studentId = req.params.id;

    if (req.user.role === 'student' && req.user.linkedStudentId !== studentId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Get courses for this student's semester
    const courses = await Course.find({ semester: student.semester }).populate('teacherId', 'name email');

    // Get all attendance records for this student
    const attendanceRecords = await Attendance.find({ studentId }).populate('courseId');

    // Get all marks records for this student
    const marksRecords = await Marks.find({ studentId }).populate('courseId');

    // Build subject-wise comprehensive report
    let grandTotalAttended = 0;
    let grandTotalClasses = 0;
    let grandTotalMarksObtained = 0;
    let grandTotalMarksMax = 0;
    let totalCredits = 0;
    let totalCreditPoints = 0;

    const subjectsReport = courses.map(course => {
      const cId = String(course._id);
      const credits = course.credits || 4;
      totalCredits += credits;

      // Attendance for this subject
      const subAttendance = attendanceRecords.filter(a => String(a.courseId._id || a.courseId) === cId);
      const totalClasses = subAttendance.length;
      const attended = subAttendance.filter(a => a.status === 'Present').length;
      const attendancePct = totalClasses > 0 ? Math.round((attended / totalClasses) * 1000) / 10 : 0;

      grandTotalClasses += totalClasses;
      grandTotalAttended += attended;

      // Marks for this subject
      const subMarks = marksRecords.filter(m => String(m.courseId._id || m.courseId) === cId);
      let subjectObtained = 0;
      let subjectMax = 0;
      const examBreakdown = {};

      subMarks.forEach(m => {
        examBreakdown[m.examType] = {
          obtained: m.obtainedMarks,
          max: m.maxMarks,
          percentage: Math.round((m.obtainedMarks / m.maxMarks) * 1000) / 10
        };
        subjectObtained += m.obtainedMarks;
        subjectMax += m.maxMarks;
      });

      grandTotalMarksObtained += subjectObtained;
      grandTotalMarksMax += subjectMax;

      const subjectPct = subjectMax > 0 ? Math.round((subjectObtained / subjectMax) * 1000) / 10 : 0;
      const gradeInfo = getGrade(subjectPct);
      const isPass = subjectPct >= 40;

      totalCreditPoints += (credits * gradeInfo.points);

      return {
        courseId: cId,
        courseName: course.name,
        courseCode: course.code,
        credits,
        instructor: course.teacherId ? course.teacherId.name : 'Faculty Staff',
        attendance: {
          totalClasses,
          attended,
          percentage: attendancePct,
          isLowAttendance: attendancePct < 75
        },
        exams: examBreakdown,
        marks: {
          totalObtained: subjectObtained,
          totalMax: subjectMax,
          percentage: subjectPct
        },
        grade: gradeInfo.grade,
        gradeLabel: gradeInfo.label,
        gradePoints: gradeInfo.points,
        status: isPass ? 'PASS' : (subjectMax === 0 ? 'N/A' : 'FAIL')
      };
    });

    const overallAttendancePct = grandTotalClasses > 0
      ? Math.round((grandTotalAttended / grandTotalClasses) * 1000) / 10
      : 0;

    const overallMarksPct = grandTotalMarksMax > 0
      ? Math.round((grandTotalMarksObtained / grandTotalMarksMax) * 1000) / 10
      : 0;

    const overallGradeInfo = getGrade(overallMarksPct);
    const sgpa = totalCredits > 0 ? Math.round((totalCreditPoints / totalCredits) * 100) / 100 : 0;
    const hasFailed = subjectsReport.some(s => s.status === 'FAIL');

    res.json({
      success: true,
      report: {
        student,
        academicYear: '2026-2027',
        generatedDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        overallAttendance: {
          totalClasses: grandTotalClasses,
          attended: grandTotalAttended,
          percentage: overallAttendancePct,
          isLowAttendance: overallAttendancePct < 75
        },
        overallPerformance: {
          totalObtained: grandTotalMarksObtained,
          totalMax: grandTotalMarksMax,
          percentage: overallMarksPct,
          grade: overallGradeInfo.grade,
          sgpa,
          status: hasFailed ? 'FAIL' : (grandTotalMarksMax > 0 ? 'PASS' : 'INCOMPLETE')
        },
        subjects: subjectsReport
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/class - Class performance overview filtered by Course & Semester
// Allowed: Admin, Teacher
router.get('/class', authenticateToken, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { courseName, semester } = req.query;
    const filter = { status: 'active' };

    if (courseName) filter.courseName = courseName;
    if (semester) filter.semester = parseInt(semester);

    const students = await Student.find(filter).sort({ rollNumber: 1 });
    const studentIds = students.map(s => String(s._id));

    // Attendance records
    const attendanceRecords = await Attendance.find({ studentId: { $in: studentIds } });
    const marksRecords = await Marks.find({ studentId: { $in: studentIds } });

    const studentReports = students.map(student => {
      const sId = String(student._id);
      const studentAtt = attendanceRecords.filter(a => String(a.studentId._id || a.studentId) === sId);
      const totalClasses = studentAtt.length;
      const attended = studentAtt.filter(a => a.status === 'Present').length;
      const attPct = totalClasses > 0 ? Math.round((attended / totalClasses) * 1000) / 10 : 0;

      const studentMarks = marksRecords.filter(m => String(m.studentId._id || m.studentId) === sId);
      let obtained = 0;
      let max = 0;
      studentMarks.forEach(m => {
        obtained += m.obtainedMarks;
        max += m.maxMarks;
      });
      const marksPct = max > 0 ? Math.round((obtained / max) * 1000) / 10 : 0;
      const grade = getGrade(marksPct).grade;

      return {
        studentId: sId,
        rollNumber: student.rollNumber,
        name: student.name,
        semester: student.semester,
        courseName: student.courseName,
        attendancePercentage: attPct,
        isLowAttendance: attPct < 75,
        marksPercentage: marksPct,
        grade,
        status: marksPct >= 40 ? 'PASS' : (max === 0 ? 'PENDING' : 'FAIL')
      };
    });

    res.json({
      success: true,
      filter: { courseName: courseName || 'All', semester: semester || 'All' },
      totalStudents: students.length,
      students: studentReports
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

