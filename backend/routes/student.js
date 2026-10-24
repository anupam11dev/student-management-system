const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Student, User, Attendance, Marks, Course } = require('../models');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/students - List students with search, filters & pagination
// Allowed: Admin, Teacher
router.get('/', authenticateToken, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const search = (req.query.search || '').trim();
    const course = (req.query.course || '').trim();
    const semester = req.query.semester ? parseInt(req.query.semester) : null;

    const filter = {};

    if (course) {
      filter.courseName = course;
    }

    if (semester) {
      filter.semester = semester;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Student.countDocuments(filter);
    const students = await Student.find(filter)
      .sort({ rollNumber: 1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      students,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/students/:id - View single student details
// Allowed: Admin, Teacher, own Student
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const studentId = req.params.id;

    // Student can only view their own profile
    if (req.user.role === 'student' && req.user.linkedStudentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own student record.'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.'
      });
    }

    // Also fetch enrolled courses for student's semester and courseName
    const courses = await Course.find({
      semester: student.semester
    }).populate('teacherId');

    res.json({
      success: true,
      student,
      enrolledCourses: courses
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/students - Add new student
// Allowed: Admin only
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      name,
      rollNumber,
      email,
      phone,
      address,
      dob,
      courseName,
      semester,
      section,
      createAccount,
      password
    } = req.body;

    if (!name || !rollNumber || !email || !phone || !dob || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Name, roll number, email, phone, date of birth, and semester are required.'
      });
    }

    const cleanRoll = rollNumber.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const numSemester = parseInt(semester);

    if (numSemester < 1 || numSemester > 8) {
      return res.status(400).json({
        success: false,
        message: 'Semester must be an integer between 1 and 8.'
      });
    }

    // Validate unique rollNumber
    const existingRoll = await Student.findOne({ rollNumber: cleanRoll });
    if (existingRoll) {
      return res.status(400).json({
        success: false,
        message: `Roll number '${cleanRoll}' is already assigned to student ${existingRoll.name}.`
      });
    }

    // Validate unique email
    const existingEmail = await Student.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: `A student with email '${cleanEmail}' already exists.`
      });
    }

    // Create student
    const student = await Student.create({
      name: name.trim(),
      rollNumber: cleanRoll,
      email: cleanEmail,
      phone: phone.trim(),
      address: (address || '').trim(),
      dob: String(dob).substring(0, 10),
      courseName: courseName ? courseName.trim() : 'BTech CSE',
      semester: numSemester,
      section: section ? section.trim().toUpperCase() : 'A',
      status: 'active'
    });

    let createdUser = null;
    // FR-2.7: Creating a student can also create a linked Student login account
    if (createAccount === true || createAccount === 'true') {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (!existingUser) {
        const studentPassword = password || 'Student@123';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(studentPassword, salt);

        createdUser = await User.create({
          name: student.name,
          username: cleanRoll.toLowerCase(),
          email: cleanEmail,
          password: hashedPassword,
          role: 'student',
          phone: student.phone,
          linkedStudentId: student._id
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Student added successfully.',
      student,
      accountCreated: !!createdUser,
      defaultCredentials: createdUser ? { email: cleanEmail, password: password || 'Student@123' } : null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/students/:id - Update student details
// Allowed: Admin only
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const studentId = req.params.id;
    const existing = await Student.findById(studentId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const {
      name,
      rollNumber,
      email,
      phone,
      address,
      dob,
      courseName,
      semester,
      section,
      status
    } = req.body;

    const updates = {};
    if (name) updates.name = name.trim();

    if (rollNumber) {
      const cleanRoll = rollNumber.trim().toUpperCase();
      if (cleanRoll !== existing.rollNumber) {
        const dup = await Student.findOne({ rollNumber: cleanRoll, _id: { $ne: studentId } });
        if (dup) {
          return res.status(400).json({
            success: false,
            message: `Roll number '${cleanRoll}' is already in use by another student.`
          });
        }
        updates.rollNumber = cleanRoll;
      }
    }

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== existing.email) {
        const dup = await Student.findOne({ email: cleanEmail, _id: { $ne: studentId } });
        if (dup) {
          return res.status(400).json({
            success: false,
            message: `Email '${cleanEmail}' is already in use by another student.`
          });
        }
        updates.email = cleanEmail;
      }
    }

    if (phone) updates.phone = phone.trim();
    if (address !== undefined) updates.address = address.trim();
    if (dob) updates.dob = String(dob).substring(0, 10);
    if (courseName) updates.courseName = courseName.trim();
    if (semester) {
      const s = parseInt(semester);
      if (s < 1 || s > 8) {
        return res.status(400).json({ success: false, message: 'Semester must be between 1 and 8.' });
      }
      updates.semester = s;
    }
    if (section) updates.section = section.trim().toUpperCase();
    if (status) updates.status = status;

    const updatedStudent = await Student.findByIdAndUpdate(studentId, updates, { new: true });

    // Sync email / name to linked user if exists
    if (updates.email || updates.name) {
      await User.updateOne(
        { linkedStudentId: studentId },
        {
          ...(updates.email && { email: updates.email }),
          ...(updates.name && { name: updates.name })
        }
      );
    }

    res.json({
      success: true,
      message: 'Student updated successfully.',
      student: updatedStudent
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/students/:id - Delete student
// Allowed: Admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const studentId = req.params.id;
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Delete student
    await Student.findByIdAndDelete(studentId);

    // Also clean up linked attendance, marks, and user login
    await Attendance.deleteMany({ studentId });
    await Marks.deleteMany({ studentId });
    await User.deleteMany({ linkedStudentId: studentId });

    res.json({
      success: true,
      message: `Student '${student.name}' (${student.rollNumber}) and all associated academic records deleted successfully.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

