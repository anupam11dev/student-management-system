const express = require('express');
const router = express.Router();
const { Marks, Course, Student } = require('../models');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Helper to determine Grade and Status
const calculateGrade = (percentage) => {
  if (percentage >= 90) return { grade: 'A+', label: 'Outstanding', passed: true };
  if (percentage >= 80) return { grade: 'A', label: 'Excellent', passed: true };
  if (percentage >= 70) return { grade: 'B+', label: 'Very Good', passed: true };
  if (percentage >= 60) return { grade: 'B', label: 'Good', passed: true };
  if (percentage >= 50) return { grade: 'C', label: 'Average', passed: true };
  if (percentage >= 40) return { grade: 'D', label: 'Pass', passed: true };
  return { grade: 'F', label: 'Fail', passed: false };
};

// POST /api/marks - Save or update marks (Single or Batch)
// Allowed: Admin, Teacher (assigned)
router.post('/', authenticateToken, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { courseId, examType, entries } = req.body;

    if (!courseId || !examType) {
      return res.status(400).json({
        success: false,
        message: 'Course ID and Exam Type (Assignment, Internal, Semester) are required.'
      });
    }

    if (!['Assignment', 'Internal', 'Semester'].includes(examType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Exam Type. Must be Assignment, Internal, or Semester.'
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
          message: 'Forbidden. You are only authorized to enter marks for courses assigned to you.'
        });
      }
    }

    // Support both single entry and batch entries array
    const markEntries = Array.isArray(entries)
      ? entries
      : [{
          studentId: req.body.studentId,
          obtainedMarks: req.body.obtainedMarks,
          maxMarks: req.body.maxMarks,
          remarks: req.body.remarks
        }];

    if (markEntries.length === 0 || !markEntries[0].studentId) {
      return res.status(400).json({
        success: false,
        message: 'At least one student mark entry is required.'
      });
    }

    const savedRecords = [];
    const errors = [];

    for (const entry of markEntries) {
      const { studentId, obtainedMarks, maxMarks, remarks } = entry;
      const numObtained = parseFloat(obtainedMarks);
      const numMax = parseFloat(maxMarks);

      // Validation: FR-5.2 numeric, non-negative, not above maximum marks
      if (isNaN(numObtained) || isNaN(numMax)) {
        errors.push(`Student ${studentId}: Marks must be numeric.`);
        continue;
      }

      if (numObtained < 0) {
        errors.push(`Student ${studentId}: Obtained marks cannot be negative (${numObtained}).`);
        continue;
      }

      if (numMax <= 0) {
        errors.push(`Student ${studentId}: Max marks must be greater than zero (${numMax}).`);
        continue;
      }

      if (numObtained > numMax) {
        errors.push(`Student ${studentId}: Obtained marks (${numObtained}) cannot exceed max marks (${numMax}).`);
        continue;
      }

      // Upsert record: one record per (studentId, courseId, examType)
      await Marks.updateOne(
        {
          studentId: String(studentId),
          courseId: String(courseId),
          examType
        },
        {
          $set: {
            studentId: String(studentId),
            courseId: String(courseId),
            examType,
            obtainedMarks: numObtained,
            maxMarks: numMax,
            enteredBy: req.user._id,
            remarks: remarks || ''
          }
        },
        { upsert: true }
      );

      savedRecords.push({ studentId, obtainedMarks: numObtained, maxMarks: numMax });
    }

    res.json({
      success: true,
      message: `Marks recorded successfully for ${savedRecords.length} student(s).`,
      savedCount: savedRecords.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/marks - Query marks list with filters
// Allowed: Admin, Teacher, own Student
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { courseId, studentId, examType } = req.query;
    const filter = {};

    if (req.user.role === 'student') {
      if (!req.user.linkedStudentId) {
        return res.status(403).json({ success: false, message: 'No student profile linked.' });
      }
      filter.studentId = req.user.linkedStudentId;
    } else if (studentId) {
      filter.studentId = studentId;
    }

    if (courseId) filter.courseId = courseId;
    if (examType) filter.examType = examType;

    const records = await Marks.find(filter)
      .populate('studentId', 'name rollNumber semester courseName')
      .populate('courseId', 'name code semester credits')
      .populate('enteredBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: records.length,
      marks: records
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/marks/course-sheet - Fetch students and their current marks for a course & exam
// Allowed: Admin, Teacher
router.get('/course-sheet', authenticateToken, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { courseId, examType } = req.query;
    if (!courseId) {
      return res.status(400).json({ success: false, message: 'courseId is required' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const students = await Student.find({ semester: course.semester, status: { $ne: 'inactive' } })
      .sort({ rollNumber: 1 });

    const existingMarks = await Marks.find({
      courseId,
      ...(examType && { examType })
    });

    const marksMap = {};
    existingMarks.forEach(m => {
      const sId = String(m.studentId._id || m.studentId);
      const eType = m.examType;
      if (!marksMap[sId]) marksMap[sId] = {};
      marksMap[sId][eType] = {
        obtainedMarks: m.obtainedMarks,
        maxMarks: m.maxMarks,
        remarks: m.remarks
      };
    });

    res.json({
      success: true,
      course,
      students: students.map(s => {
        const plain = s.toObject ? s.toObject() : { ...s };
        return {
          ...plain,
          _id: String(plain._id || s._id),
          marks: marksMap[String(s._id)] || {}
        };
      })
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/marks/student/:id - Complete academic result calculation for student
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

    // Get all marks records for this student
    const allMarks = await Marks.find({ studentId }).populate('courseId');

    // Group marks by course
    const courseMap = {};
    let totalObtained = 0;
    let totalMax = 0;

    for (const m of allMarks) {
      const cId = String(m.courseId._id || m.courseId);
      const cName = m.courseId.name || 'Course';
      const cCode = m.courseId.code || 'N/A';
      const credits = m.courseId.credits || 4;

      if (!courseMap[cId]) {
        courseMap[cId] = {
          courseId: cId,
          name: cName,
          code: cCode,
          credits,
          exams: {},
          subjectTotalObtained: 0,
          subjectTotalMax: 0
        };
      }

      courseMap[cId].exams[m.examType] = {
        obtained: m.obtainedMarks,
        max: m.maxMarks,
        percentage: Math.round((m.obtainedMarks / m.maxMarks) * 1000) / 10
      };

      courseMap[cId].subjectTotalObtained += m.obtainedMarks;
      courseMap[cId].subjectTotalMax += m.maxMarks;

      totalObtained += m.obtainedMarks;
      totalMax += m.maxMarks;
    }

    // Calculate subject-wise percentages and grades
    const subjects = Object.values(courseMap).map(sub => {
      const pct = sub.subjectTotalMax > 0
        ? Math.round((sub.subjectTotalObtained / sub.subjectTotalMax) * 1000) / 10
        : 0;
      const evaluation = calculateGrade(pct);
      return {
        ...sub,
        percentage: pct,
        grade: evaluation.grade,
        status: evaluation.passed ? 'PASS' : 'FAIL',
        label: evaluation.label
      };
    });

    const overallPct = totalMax > 0
      ? Math.round((totalObtained / totalMax) * 1000) / 10
      : 0;

    const overallGrade = calculateGrade(overallPct);
    const hasFailedAny = subjects.some(s => s.status === 'FAIL');

    res.json({
      success: true,
      student,
      result: {
        totalObtained,
        totalMax,
        overallPercentage: overallPct,
        grade: overallGrade.grade,
        status: hasFailedAny ? 'FAIL' : (overallGrade.passed ? 'PASS' : 'FAIL'),
        subjects
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

