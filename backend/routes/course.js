const express = require('express');
const router = express.Router();
const { Course, Student, User, Attendance, Marks } = require('../models');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/courses - List all courses with optional filters (semester, teacherId)
// Allowed: All authenticated users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { semester, teacherId, search } = req.query;
    const filter = {};

    if (semester) {
      filter.semester = parseInt(semester);
    }

    if (teacherId) {
      filter.teacherId = teacherId;
    }

    // If teacher role and requesting "my courses", filter by req.user._id
    if (req.user.role === 'teacher' && req.query.mine === 'true') {
      filter.teacherId = req.user._id;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const courses = await Course.find(filter)
      .populate('teacherId', 'name email department')
      .sort({ semester: 1, code: 1 });

    // Attach enrolled student count to each course
    const enriched = await Promise.all(
      courses.map(async (course) => {
        const studentCount = await Student.countDocuments({
          semester: course.semester
        });
        // Use toObject() if Mongoose document, otherwise use plain object directly
        const plainCourse = course.toObject ? course.toObject() : { ...course };
        return {
          ...plainCourse,
          _id: String(plainCourse._id || course._id),
          studentCount
        };
      })
    );

    res.json({
      success: true,
      courses: enriched
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/courses/:id - Course details
// Allowed: All authenticated users
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('teacherId', 'name email department');
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const enrolledStudents = await Student.find({ semester: course.semester })
      .sort({ rollNumber: 1 });

    res.json({
      success: true,
      course,
      enrolledStudents,
      enrolledCount: enrolledStudents.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/courses/:id/students - Students enrolled in this course
// Allowed: Admin, Teacher
router.get('/:id/students', authenticateToken, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('teacherId', 'name email');
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const assignedTeacherId = course.teacherId ? String(course.teacherId._id || course.teacherId) : null;
    const isAssignedInstructor = req.user.role === 'admin' || (assignedTeacherId === req.user._id);

    const students = await Student.find({
      semester: course.semester,
      status: { $ne: 'inactive' }
    }).sort({ rollNumber: 1 });

    res.json({
      success: true,
      course,
      isAssignedInstructor,
      students
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/courses - Add course
// Allowed: Admin, Teacher
router.post('/', authenticateToken, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { name, code, semester, department, credits, teacherId, description } = req.body;

    if (!name || !code || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Course name, code, and semester are required.'
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanSemester = parseInt(semester);

    if (cleanSemester < 1 || cleanSemester > 8) {
      return res.status(400).json({
        success: false,
        message: 'Semester must be between 1 and 8.'
      });
    }

    // Unique course code check
    const existing = await Course.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Course with code '${cleanCode}' already exists (${existing.name}).`
      });
    }

    // If teacher role, assign directly to the logged-in teacher; if admin, use provided teacherId
    let verifiedTeacherId = req.user.role === 'teacher' ? req.user._id : null;
    if (req.user.role === 'admin' && teacherId) {
      const teacher = await User.findById(teacherId);
      if (teacher && teacher.role === 'teacher') {
        verifiedTeacherId = teacher._id;
      }
    }

    const newCourse = await Course.create({
      name: name.trim(),
      code: cleanCode,
      semester: cleanSemester,
      department: department ? department.trim() : 'CSE',
      credits: credits ? parseInt(credits) : 4,
      teacherId: verifiedTeacherId,
      description: description ? description.trim() : ''
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully.',
      course: newCourse
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/courses/:id - Update course
// Allowed: Admin only
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const courseId = req.params.id;
    const existing = await Course.findById(courseId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const { name, code, semester, department, credits, teacherId, description } = req.body;
    const updates = {};

    if (name) updates.name = name.trim();
    if (code) {
      const cleanCode = code.trim().toUpperCase();
      if (cleanCode !== existing.code) {
        const dup = await Course.findOne({ code: cleanCode, _id: { $ne: courseId } });
        if (dup) {
          return res.status(400).json({
            success: false,
            message: `Course code '${cleanCode}' is already taken.`
          });
        }
        updates.code = cleanCode;
      }
    }
    if (semester) {
      const sem = parseInt(semester);
      if (sem < 1 || sem > 8) {
        return res.status(400).json({ success: false, message: 'Semester must be between 1 and 8.' });
      }
      updates.semester = sem;
    }
    if (department) updates.department = department.trim();
    if (credits) updates.credits = parseInt(credits);
    if (description !== undefined) updates.description = description.trim();

    if (teacherId !== undefined) {
      if (teacherId === null || teacherId === '') {
        updates.teacherId = null;
      } else {
        const teacher = await User.findById(teacherId);
        if (teacher && teacher.role === 'teacher') {
          updates.teacherId = teacher._id;
        }
      }
    }

    const updatedCourse = await Course.findByIdAndUpdate(courseId, updates, { new: true });

    res.json({
      success: true,
      message: 'Course updated successfully.',
      course: updatedCourse
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/courses/:id - Delete course
// Allowed: Admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    await Course.findByIdAndDelete(courseId);
    await Attendance.deleteMany({ courseId });
    await Marks.deleteMany({ courseId });

    res.json({
      success: true,
      message: `Course '${course.name}' (${course.code}) and associated records deleted successfully.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

