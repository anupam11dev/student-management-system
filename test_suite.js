const http = require('http');
const { Readable } = require('stream');
const { app } = require('./backend/server');

const request = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const stream = body ? Readable.from([bodyStr]) : Readable.from([]);

    const headers = {
      host: 'localhost',
      ...(body ? {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(bodyStr)
      } : {})
    };

    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }

    const req = Object.assign(stream, {
      method,
      url: path,
      headers
    });

    const res = new http.ServerResponse(req);
    let output = '';

    res.write = (chunk) => {
      output += chunk;
      return true;
    };

    res.end = (chunk) => {
      if (chunk) output += chunk;
      let parsed = null;
      try {
        parsed = JSON.parse(output);
      } catch (e) {
        parsed = output;
      }
      resolve({ status: res.statusCode, data: parsed });
    };

    app(req, res);
  });
};

const runTests = async () => {
  console.log('🚀 Starting Student Management System (SMS) Comprehensive Test Suite...\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, name) => {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  };

  try {
    // 1. Health check
    console.log('--- 1. Health & Server Check ---');
    const health = await request('/api/health');
    assert(health.status === 200 && health.data.appName.includes('Student Management'), 'Server is healthy & online');

    // 2. Authentication Tests
    console.log('\n--- 2. Authentication & Role Logins ---');
    // Admin login
    const adminLogin = await request('/api/auth/login', 'POST', {
      email: 'admin@sms.edu',
      password: 'Admin@123'
    });
    assert(adminLogin.status === 200 && adminLogin.data.user.role === 'admin', 'Admin login successful with JWT');
    const adminToken = adminLogin.data.token;

    // Teacher login
    const teacherLogin = await request('/api/auth/login', 'POST', {
      email: 'sharma.teacher@sms.edu',
      password: 'Teacher@123'
    });
    assert(teacherLogin.status === 200 && teacherLogin.data.user.role === 'teacher', 'Teacher login successful with JWT');
    const teacherToken = teacherLogin.data.token;

    // Student login
    const studentLogin = await request('/api/auth/login', 'POST', {
      email: 'rahul@sms.edu',
      password: 'Student@123'
    });
    assert(studentLogin.status === 200 && studentLogin.data.user.role === 'student', 'Student login successful with JWT');
    const studentToken = studentLogin.data.token;
    const studentProfileId = studentLogin.data.user.linkedStudentId;

    // Bad password
    const badLogin = await request('/api/auth/login', 'POST', {
      email: 'admin@sms.edu',
      password: 'WrongPassword'
    });
    assert(badLogin.status === 401, 'Bad credentials correctly rejected (401)');

    // 3. Student Management (FR-2)
    console.log('\n--- 3. Student Management & Validation (FR-2) ---');
    const studentsList = await request('/api/students', 'GET', null, adminToken);
    assert(studentsList.status === 200 && studentsList.data.students.length >= 6, 'Admin can list students with pagination');

    // Add unique student
    const newRoll = 'TEST' + Date.now().toString().substring(7);
    const addStudent = await request('/api/students', 'POST', {
      name: 'Test Student',
      rollNumber: newRoll,
      email: `test_${Date.now()}@sms.edu`,
      phone: '+91 99999 88888',
      dob: '2005-01-01',
      courseName: 'BTech CSE',
      semester: 3,
      createAccount: true
    }, adminToken);
    assert(addStudent.status === 201 && addStudent.data.accountCreated === true, 'Admin can create student with auto login account');

    // Roll number duplication rejection (FR-2.6)
    const dupRoll = await request('/api/students', 'POST', {
      name: 'Duplicate Student',
      rollNumber: newRoll,
      email: `dup_${Date.now()}@sms.edu`,
      phone: '+91 99999 88888',
      dob: '2005-01-01',
      semester: 3
    }, adminToken);
    assert(dupRoll.status === 400 && dupRoll.data.message.includes('already assigned'), 'Duplicate roll number strictly rejected (400)');

    // 4. Course Management (FR-3)
    console.log('\n--- 4. Course Management & Constraints (FR-3) ---');
    const coursesRes = await request('/api/courses', 'GET', null, studentToken);
    assert(coursesRes.status === 200 && coursesRes.data.courses.length >= 5, 'Students & users can list courses with enrolled counts');

    // 5. Attendance Management (FR-4)
    console.log('\n--- 5. Attendance Calculation & Threshold Validation (FR-4) ---');
    const courseId = coursesRes.data.courses[0]._id;
    const testDate = '2026-10-22';

    // Batch mark attendance
    const attendancePost = await request('/api/attendance', 'POST', {
      courseId,
      date: testDate,
      records: [
        { studentId: studentProfileId, status: 'Present' }
      ]
    }, teacherToken);
    assert(attendancePost.status === 200, 'Teacher can batch record attendance');

    // Attendance summary calculation
    const attSummary = await request(`/api/attendance/summary?studentId=${studentProfileId}`, 'GET', null, studentToken);
    assert(attSummary.status === 200 && attSummary.data.summary.overallPercentage > 0, `Attendance % calculated accurately: ${attSummary.data.summary.overallPercentage}%`);

    // 6. Marks & Results Management (FR-5)
    console.log('\n--- 6. Marks Validation & Results Calculation (FR-5) ---');
    // Boundary validation: Reject marks exceeding max (FR-5.2)
    const invalidMarks = await request('/api/marks', 'POST', {
      courseId,
      examType: 'Assignment',
      entries: [
        { studentId: studentProfileId, obtainedMarks: 25, maxMarks: 20 }
      ]
    }, teacherToken);
    assert(invalidMarks.data.errors && invalidMarks.data.errors.length > 0, 'Obtained marks > Max marks strictly rejected (FR-5.2)');

    // Valid marks entry
    const validMarks = await request('/api/marks', 'POST', {
      courseId,
      examType: 'Assignment',
      entries: [
        { studentId: studentProfileId, obtainedMarks: 18, maxMarks: 20 }
      ]
    }, teacherToken);
    assert(validMarks.status === 200 && validMarks.data.savedCount === 1, 'Valid marks entry saved successfully');

    // Student result calculation
    const studentResult = await request(`/api/marks/student/${studentProfileId}`, 'GET', null, studentToken);
    assert(studentResult.status === 200 && studentResult.data.result.subjects.length > 0, 'Subject-wise results, percentages and grades calculated');

    // 7. Academic Reports & Transcripts (FR-7)
    console.log('\n--- 7. Academic Reports & Transcripts (FR-7) ---');
    const transcript = await request(`/api/reports/student/${studentProfileId}`, 'GET', null, studentToken);
    assert(transcript.status === 200 && transcript.data.report.student.rollNumber === 'CSE2026001', 'Official transcript generated with combined profile, attendance & marks');

    const classReport = await request('/api/reports/class?courseName=BTech%20CSE&semester=3', 'GET', null, adminToken);
    assert(classReport.status === 200 && classReport.data.students.length > 0, 'Class performance report generated for Course & Semester filter');

    // 8. Security & Authorization Enforcement
    console.log('\n--- 8. Security & Role Authorization Enforcement ---');
    // Student trying to post marks
    const studentAttempt = await request('/api/marks', 'POST', {
      courseId,
      examType: 'Assignment',
      entries: [{ studentId: studentProfileId, obtainedMarks: 20, maxMarks: 20 }]
    }, studentToken);
    assert(studentAttempt.status === 403, 'Student cannot tamper marks (403 Forbidden enforced)');

    // Student trying to delete another student
    const deleteAttempt = await request(`/api/students/${studentProfileId}`, 'DELETE', null, studentToken);
    assert(deleteAttempt.status === 403, 'Student cannot delete records (403 Forbidden enforced)');

    console.log('\n======================================================');
    console.log(`🏁 TEST RUN FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test Suite encountered error:', err);
    process.exit(1);
  }
};

runTests();

