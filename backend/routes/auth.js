const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Student, Course } = require('../models');
const { authenticateToken, requireRole } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'sms_super_secret_jwt_key_2026_btech_project';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email/username and password.'
      });
    }

    // Find user by email or username
    let user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact your administrator.'
      });
    }

    // Verify password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: String(user._id),
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    let linkedStudent = null;
    if (user.role === 'student' && user.linkedStudentId) {
      linkedStudent = await Student.findById(user.linkedStudentId);
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || 'CSE',
        linkedStudentId: user.linkedStudentId ? String(user.linkedStudentId._id || user.linkedStudentId) : null,
        studentProfile: linkedStudent || null
      }
    });
  } catch (error) {
    console.error('[Auth Error]', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication: ' + error.message
    });
  }
});

// POST /api/auth/register - Public Self-Registration for Admin, Teacher, or Student
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, department, phone, rollNumber, semester, courseName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    const assignedRole = ['admin', 'teacher', 'student'].includes(role) ? role : 'student';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let linkedStudent = null;

    if (assignedRole === 'student') {
      const generatedRoll = rollNumber ? rollNumber.trim().toUpperCase() : ('CSE' + Date.now().toString().substring(7));
      const existingStudent = await Student.findOne({ rollNumber: generatedRoll });
      const finalRoll = existingStudent ? (generatedRoll + 'A') : generatedRoll;

      linkedStudent = await Student.create({
        name: name.trim(),
        rollNumber: finalRoll,
        email: cleanEmail,
        phone: phone ? phone.trim() : '+91 98765 00000',
        dob: '2005-01-01',
        courseName: courseName ? courseName.trim() : 'BTech CSE',
        semester: semester ? parseInt(semester) : 1,
        section: 'A',
        status: 'active'
      });
    }

    const newUser = await User.create({
      name: name.trim(),
      username: cleanEmail.split('@')[0],
      email: cleanEmail,
      password: hashedPassword,
      role: assignedRole,
      department: department || 'CSE',
      phone: phone ? phone.trim() : '',
      status: 'active',
      linkedStudentId: linkedStudent ? linkedStudent._id : null
    });

    const token = jwt.sign(
      {
        id: String(newUser._id),
        email: newUser.email,
        role: newUser.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    res.status(201).json({
      success: true,
      message: `Account created successfully as ${assignedRole.toUpperCase()}.`,
      token,
      user: {
        id: String(newUser._id),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        linkedStudentId: linkedStudent ? String(linkedStudent._id) : null,
        studentProfile: linkedStudent
      }
    });
  } catch (error) {
    console.error('[Registration Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account: ' + error.message
    });
  }
});

// GET /api/auth/me - Current user details
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let linkedStudent = null;
    if (user.role === 'student' && user.linkedStudentId) {
      linkedStudent = await Student.findById(user.linkedStudentId);
    }

    let assignedCourses = [];
    if (user.role === 'teacher') {
      assignedCourses = await Course.find({ teacherId: user._id });
    }

    res.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        linkedStudentId: user.linkedStudentId ? String(user.linkedStudentId._id || user.linkedStudentId) : null,
        studentProfile: linkedStudent,
        assignedCourses
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/teachers - List all teachers (Admin only, used for course assignment)
router.get('/teachers', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher', status: 'active' });
    res.json({
      success: true,
      teachers: teachers.map(t => ({
        id: String(t._id),
        _id: String(t._id),
        name: t.name,
        email: t.email,
        department: t.department || 'CSE'
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/register-teacher (Admin only)
router.post('/register-teacher', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, department, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newTeacher = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: 'teacher',
      department: department || 'CSE',
      phone: phone || ''
    });

    res.status(201).json({
      success: true,
      message: 'Faculty member registered successfully.',
      teacher: {
        id: String(newTeacher._id),
        name: newTeacher.name,
        email: newTeacher.email,
        department: newTeacher.department
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

module.exports = router;

