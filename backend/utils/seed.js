const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { connectDB } = require('../config/database');
const { User, Student, Course, Attendance, Marks } = require('../models');
const { dbCache, saveToDisk } = require('../config/localStore');

const seedData = async () => {
  console.log('[Seed] Initializing database seeding...');
  await connectDB();

  // Clear existing data
  const isMongo = mongoose.connection.readyState === 1;
  if (isMongo) {
    console.log('[Seed] Clearing MongoDB collections...');
    await User.deleteMany({});
    await Student.deleteMany({});
    await Course.deleteMany({});
    await Attendance.deleteMany({});
    await Marks.deleteMany({});
  } else {
    console.log('[Seed] Clearing local store collections...');
    dbCache.users = [];
    dbCache.students = [];
    dbCache.courses = [];
    dbCache.attendance = [];
    dbCache.marks = [];
  }

  console.log('[Seed] Hashing passwords...');
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('Admin@123', salt);
  const teacherPassword = await bcrypt.hash('Teacher@123', salt);
  const studentPassword = await bcrypt.hash('Student@123', salt);

  // 1. Create Admin User
  const adminUser = await User.create({
    name: 'Dr. Vikram Sethi',
    username: 'admin',
    email: 'admin@sms.edu',
    password: adminPassword,
    role: 'admin',
    department: 'Administration',
    phone: '+91 98765 43210'
  });
  console.log('✅ Admin created: admin@sms.edu / Admin@123');

  // 2. Create Teachers
  const teacher1 = await User.create({
    name: 'Prof. Rajesh Sharma',
    username: 'prof.sharma',
    email: 'sharma.teacher@sms.edu',
    password: teacherPassword,
    role: 'teacher',
    department: 'Computer Science & Engineering',
    phone: '+91 98111 22334'
  });

  const teacher2 = await User.create({
    name: 'Prof. Priya Nair',
    username: 'prof.priya',
    email: 'priya.teacher@sms.edu',
    password: teacherPassword,
    role: 'teacher',
    department: 'Computer Science & Engineering',
    phone: '+91 98222 33445'
  });
  console.log('✅ Teachers created: sharma.teacher@sms.edu / Teacher@123');

  // 3. Create Courses
  const course1 = await Course.create({
    name: 'Data Structures & Algorithms',
    code: 'CS301',
    semester: 3,
    department: 'CSE',
    credits: 4,
    teacherId: teacher1._id,
    description: 'Arrays, Stacks, Queues, Linked Lists, Trees, Graphs, Sorting & Searching.'
  });

  const course2 = await Course.create({
    name: 'Database Management Systems',
    code: 'CS302',
    semester: 3,
    department: 'CSE',
    credits: 4,
    teacherId: teacher2._id,
    description: 'Relational Model, SQL, Normalization, Transactions, Concurrency Control.'
  });

  const course3 = await Course.create({
    name: 'Operating Systems',
    code: 'CS303',
    semester: 3,
    department: 'CSE',
    credits: 4,
    teacherId: teacher1._id,
    description: 'Process Management, Threads, CPU Scheduling, Memory Management, Deadlocks.'
  });

  const course4 = await Course.create({
    name: 'Computer Organization & Architecture',
    code: 'CS304',
    semester: 3,
    department: 'CSE',
    credits: 3,
    teacherId: teacher2._id,
    description: 'Instruction Set, ALU Design, Pipelining, Memory Hierarchy, I/O Interfacing.'
  });

  const course5 = await Course.create({
    name: 'Software Engineering',
    code: 'CS501',
    semester: 5,
    department: 'CSE',
    credits: 4,
    teacherId: teacher1._id,
    description: 'Software Development Life Cycle, Agile Scrum, System Modeling, Testing.'
  });
  console.log('✅ 5 Courses created');

  // 4. Create Students (Semester 3 and Semester 5)
  const student1 = await Student.create({
    name: 'Rahul Sharma',
    rollNumber: 'CSE2026001',
    email: 'rahul@sms.edu',
    phone: '+91 91234 56789',
    address: '42 Academic Avenue, New Delhi, India',
    dob: '2005-04-14',
    courseName: 'BTech CSE',
    semester: 3,
    section: 'A',
    status: 'active'
  });

  const student2 = await Student.create({
    name: 'Ananya Patel',
    rollNumber: 'CSE2026002',
    email: 'ananya@sms.edu',
    phone: '+91 92345 67890',
    address: '15 Sardar Road, Ahmedabad, Gujarat',
    dob: '2005-09-21',
    courseName: 'BTech CSE',
    semester: 3,
    section: 'A',
    status: 'active'
  });

  const student3 = await Student.create({
    name: 'Amit Kumar',
    rollNumber: 'CSE2026003',
    email: 'amit@sms.edu',
    phone: '+91 93456 78901',
    address: '77 Lake View Colony, Patna, Bihar',
    dob: '2004-11-05',
    courseName: 'BTech CSE',
    semester: 3,
    section: 'A',
    status: 'active'
  });

  const student4 = await Student.create({
    name: 'Sneha Reddy',
    rollNumber: 'CSE2026004',
    email: 'sneha@sms.edu',
    phone: '+91 94567 89012',
    address: '8 Jubilee Hills, Hyderabad, Telangana',
    dob: '2005-02-18',
    courseName: 'BTech CSE',
    semester: 3,
    section: 'B',
    status: 'active'
  });

  const student5 = await Student.create({
    name: 'Vikas Gupta',
    rollNumber: 'CSE2026005',
    email: 'vikas@sms.edu',
    phone: '+91 95678 90123',
    address: '102 Civil Lines, Lucknow, Uttar Pradesh',
    dob: '2005-07-30',
    courseName: 'BTech CSE',
    semester: 3,
    section: 'B',
    status: 'active'
  });

  const student6 = await Student.create({
    name: 'Pooja Verma',
    rollNumber: 'CSE2026006',
    email: 'pooja@sms.edu',
    phone: '+91 96789 01234',
    address: '56 Tech Park Residency, Bengaluru, Karnataka',
    dob: '2004-06-12',
    courseName: 'BTech CSE',
    semester: 5,
    section: 'A',
    status: 'active'
  });
  console.log('✅ 6 Students created');

  // 5. Create Linked Student Accounts for Login
  await User.create({
    name: student1.name,
    username: 'cse2026001',
    email: student1.email,
    password: studentPassword,
    role: 'student',
    phone: student1.phone,
    linkedStudentId: student1._id
  });

  await User.create({
    name: student2.name,
    username: 'cse2026002',
    email: student2.email,
    password: studentPassword,
    role: 'student',
    phone: student2.phone,
    linkedStudentId: student2._id
  });
  console.log('✅ Student login accounts created: rahul@sms.edu / Student@123');

  // 6. Create Attendance History across multiple dates
  const dates = [
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
    '2026-10-19',
    '2026-10-20',
    '2026-10-21',
    '2026-10-22' // Today
  ];

  const sem3Students = [student1, student2, student3, student4, student5];
  const sem3Courses = [course1, course2, course3, course4];

  const attendanceBatch = [];
  for (const date of dates) {
    for (const course of sem3Courses) {
      for (const student of sem3Students) {
        // Rahul has high attendance (~90%), Amit has lower attendance (<75% to show warning!)
        let isPresent = true;
        if (student.rollNumber === 'CSE2026003') { // Amit Kumar
          isPresent = (date === '2026-10-15' || date === '2026-10-19' || date === '2026-10-22');
        } else if (student.rollNumber === 'CSE2026005') { // Vikas
          isPresent = date !== '2026-10-16';
        } else {
          isPresent = true;
        }

        attendanceBatch.push({
          studentId: student._id,
          courseId: course._id,
          date,
          status: isPresent ? 'Present' : 'Absent',
          markedBy: course.teacherId || adminUser._id,
          remarks: isPresent ? 'Attended on time' : 'Absent without prior leave'
        });
      }
    }
  }

  // Attendance for Semester 5 student (Pooja Verma in CS501)
  for (const date of dates) {
    attendanceBatch.push({
      studentId: student6._id,
      courseId: course5._id,
      date,
      status: 'Present',
      markedBy: course5.teacherId || adminUser._id,
      remarks: 'Present'
    });
  }

  await Attendance.create(attendanceBatch);
  console.log(`✅ ${attendanceBatch.length} Attendance records generated.`);

  // 7. Create Marks records (Assignment, Internal, Semester)
  const marksBatch = [];

  // Rahul Sharma (High achiever)
  marksBatch.push(
    { studentId: student1._id, courseId: course1._id, examType: 'Assignment', obtainedMarks: 18.5, maxMarks: 20, enteredBy: teacher1._id },
    { studentId: student1._id, courseId: course1._id, examType: 'Internal', obtainedMarks: 27, maxMarks: 30, enteredBy: teacher1._id },
    { studentId: student1._id, courseId: course1._id, examType: 'Semester', obtainedMarks: 88, maxMarks: 100, enteredBy: teacher1._id },

    { studentId: student1._id, courseId: course2._id, examType: 'Assignment', obtainedMarks: 19, maxMarks: 20, enteredBy: teacher2._id },
    { studentId: student1._id, courseId: course2._id, examType: 'Internal', obtainedMarks: 28, maxMarks: 30, enteredBy: teacher2._id },
    { studentId: student1._id, courseId: course2._id, examType: 'Semester', obtainedMarks: 92, maxMarks: 100, enteredBy: teacher2._id },

    { studentId: student1._id, courseId: course3._id, examType: 'Assignment', obtainedMarks: 17, maxMarks: 20, enteredBy: teacher1._id },
    { studentId: student1._id, courseId: course3._id, examType: 'Internal', obtainedMarks: 26, maxMarks: 30, enteredBy: teacher1._id },
    { studentId: student1._id, courseId: course3._id, examType: 'Semester', obtainedMarks: 84, maxMarks: 100, enteredBy: teacher1._id },

    { studentId: student1._id, courseId: course4._id, examType: 'Assignment', obtainedMarks: 18, maxMarks: 20, enteredBy: teacher2._id },
    { studentId: student1._id, courseId: course4._id, examType: 'Internal', obtainedMarks: 25, maxMarks: 30, enteredBy: teacher2._id },
    { studentId: student1._id, courseId: course4._id, examType: 'Semester', obtainedMarks: 86, maxMarks: 100, enteredBy: teacher2._id }
  );

  // Ananya Patel
  marksBatch.push(
    { studentId: student2._id, courseId: course1._id, examType: 'Assignment', obtainedMarks: 17, maxMarks: 20, enteredBy: teacher1._id },
    { studentId: student2._id, courseId: course1._id, examType: 'Internal', obtainedMarks: 25, maxMarks: 30, enteredBy: teacher1._id },
    { studentId: student2._id, courseId: course1._id, examType: 'Semester', obtainedMarks: 81, maxMarks: 100, enteredBy: teacher1._id },

    { studentId: student2._id, courseId: course2._id, examType: 'Assignment', obtainedMarks: 18, maxMarks: 20, enteredBy: teacher2._id },
    { studentId: student2._id, courseId: course2._id, examType: 'Internal', obtainedMarks: 27, maxMarks: 30, enteredBy: teacher2._id },
    { studentId: student2._id, courseId: course2._id, examType: 'Semester', obtainedMarks: 89, maxMarks: 100, enteredBy: teacher2._id }
  );

  // Amit Kumar
  marksBatch.push(
    { studentId: student3._id, courseId: course1._id, examType: 'Assignment', obtainedMarks: 11, maxMarks: 20, enteredBy: teacher1._id },
    { studentId: student3._id, courseId: course1._id, examType: 'Internal', obtainedMarks: 15, maxMarks: 30, enteredBy: teacher1._id },
    { studentId: student3._id, courseId: course1._id, examType: 'Semester', obtainedMarks: 52, maxMarks: 100, enteredBy: teacher1._id }
  );

  // Pooja Verma
  marksBatch.push(
    { studentId: student6._id, courseId: course5._id, examType: 'Assignment', obtainedMarks: 19.5, maxMarks: 20, enteredBy: teacher1._id },
    { studentId: student6._id, courseId: course5._id, examType: 'Internal', obtainedMarks: 29, maxMarks: 30, enteredBy: teacher1._id },
    { studentId: student6._id, courseId: course5._id, examType: 'Semester', obtainedMarks: 94, maxMarks: 100, enteredBy: teacher1._id }
  );

  await Marks.create(marksBatch);
  console.log(`✅ ${marksBatch.length} Marks records seeded successfully.`);

  if (!isMongo) {
    saveToDisk();
    console.log('[Seed] Data successfully written to local disk store (data/sms_data.json).');
  }

  console.log('\n=========================================');
  console.log('🎉 SEEDING COMPLETE! DEMO ACCOUNTS:');
  console.log('=========================================');
  console.log('1. ADMIN:');
  console.log('   Email:    admin@sms.edu');
  console.log('   Password: Admin@123\n');
  console.log('2. TEACHER:');
  console.log('   Email:    sharma.teacher@sms.edu');
  console.log('   Password: Teacher@123\n');
  console.log('3. STUDENT:');
  console.log('   Email:    rahul@sms.edu');
  console.log('   Password: Student@123');
  console.log('=========================================\n');
};

if (require.main === module) {
  seedData()
    .then(() => {
      console.log('[Seed] Done. Exiting.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    });
}

module.exports = seedData;

