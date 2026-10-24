# Student Management System (SMS)
> **BTech CSE Mini Project** | Web-based Academic Administration Suite  
> Built with HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and MongoDB + Mongoose.

---

## 1. Overview

The **Student Management System (SMS)** is a full-stack web application designed for colleges and universities to centralize student records, course curricula, daily attendance tracking, examination marks entry, and academic grade report generation into a single portal. It replaces paper registers and scattered spreadsheets with an automated, role-based solution.

### Key Highlights
- **Role-Based Access Control (RBAC):** Distinct dashboards and security permissions for **Admin**, **Teacher**, and **Student**, strictly verified on the backend.
- **Attendance Automation:** Calculates attendance percentages `(attended / total) * 100`, prevents duplicate entries per student/course/date, and automatically highlights students below the mandatory **75%** threshold.
- **Result & Grade Computation:** Automatically validates and aggregates Assignment, Internal, and Semester marks, determining subject grades, overall percentages, SGPA, and Pass/Fail status.
- **Printable Transcripts:** Built-in print stylesheets (`@media print`) format formal college transcripts with signature lines for "Save as PDF".
- **Zero-Setup Local Evaluation:** Includes an embedded persistence engine (`data/sms_data.json`) that boots immediately out-of-the-box, with seamless switching to real **MongoDB / MongoDB Atlas** when configured in `.env`.

---

## 2. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, CSS3 (Modern Flexbox/Grid, CSS Variables, `@media print`), Vanilla JavaScript (`fetch` API) |
| **Backend** | Node.js, Express.js 5 |
| **Database** | MongoDB with Mongoose ODM (with local JSON persistence fallback) |
| **Authentication** | JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), CORS |
| **Configuration** | `dotenv` environment variables |

---

## 3. Users & Role-Based Access Matrix

| Feature / Module | Admin | Teacher | Student |
|---|:---:|:---:|:---:|
| **Dashboard** | Full institute analytics | Assigned courses & pending status | Personal attendance & results |
| **Student Profiles** | Create, Read, Update, Delete | Read & View Enrolled | View Own Profile |
| **Course Management** | Create, Edit, Delete, Assign Faculty | View Enrolled Students | View Enrolled Courses |
| **Attendance Entry** | Full Access | Assigned Courses Only | Read-Only (Own Attendance) |
| **Marks Entry** | Full Access | Assigned Courses Only | Read-Only (Own Results) |
| **Academic Transcripts** | View & Print Any Student | View & Print Course Students | View & Print Own Transcript |
| **Class Performance** | Institute-wide | Department-wide | ❌ No Access |

---

## 4. Default Demo Credentials

For quick evaluation and project demonstration, the system comes pre-seeded with these accounts (also available via **1-Click Quick Login** on the login page):

| Role | Name | Email / Username | Password |
|---|---|---|---|
| **Admin** | Dr. Vikram Sethi | `admin@sms.edu` | `Admin@123` |
| **Teacher** | Prof. Rajesh Sharma | `sharma.teacher@sms.edu` | `Teacher@123` |
| **Teacher** | Prof. Priya Nair | `priya.teacher@sms.edu` | `Teacher@123` |
| **Student** | Rahul Sharma | `rahul@sms.edu` | `Student@123` |
| **Student** | Ananya Patel | `ananya@sms.edu` | `Student@123` |

---

## 5. Folder Structure

```
Student-Management-System/
├── backend/
│   ├── config/
│   │   ├── database.js         # MongoDB connection & fallback mode detector
│   │   └── localStore.js       # Persistent JSON store for offline evaluation
│   ├── middleware/
│   │   └── auth.js             # JWT verification & role authorization guards
│   ├── models/
│   │   ├── User.js             # Admin, Teacher, Student accounts
│   │   ├── Student.js          # Student biographical data & enrollments
│   │   ├── Course.js           # Curriculum courses, semesters & instructors
│   │   ├── Attendance.js       # Daily student attendance tracking
│   │   ├── Marks.js            # Assignment, Internal & Semester scores
│   │   └── index.js            # Unified model proxy
│   ├── routes/
│   │   ├── auth.js             # Login, current user & faculty registration
│   │   ├── student.js          # Student CRUD, pagination & search
│   │   ├── course.js           # Course management & roster endpoints
│   │   ├── attendance.js       # Attendance marking & percentage calculations
│   │   ├── marks.js            # Marks entry, grade calculation & results
│   │   ├── dashboard.js        # Dynamic stats for Admin, Teacher & Student
│   │   └── report.js           # Comprehensive transcript & class reports
│   ├── utils/
│   │   └── seed.js             # Initial database seeder script
│   └── server.js               # Express application entry point
├── frontend/
│   ├── css/
│   │   └── style.css           # Global stylesheet & print rules
│   ├── js/
│   │   ├── auth.js             # Token management & API request helper
│   │   ├── navbar.js           # Dynamic role-based navigation sidebar
│   │   ├── dashboard.js        # Analytics & metrics rendering
│   │   ├── students.js         # Student directory, search & modals
│   │   ├── courses.js          # Course list, teacher assignment & enrollments
│   │   ├── attendance.js       # Attendance marking, history & threshold alert
│   │   ├── marks.js            # Grade entry sheet & result computation
│   │   └── reports.js          # Academic transcript & class roster reports
│   ├── login.html              # Authentication portal
│   ├── dashboard.html          # Role-based dashboard
│   ├── students.html           # Student management page
│   ├── courses.html            # Course & curriculum page
│   ├── attendance.html         # Daily attendance portal
│   ├── marks.html              # Examination & marks entry portal
│   └── reports.html            # Printable transcript & performance report
├── data/
│   └── sms_data.json           # Persistent offline storage database
├── .env                        # Environment configurations
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 6. Installation and Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Optional: Local Community Server or MongoDB Atlas URI)

### Quick Start (Zero Setup)

1. **Clone or Navigate to the Project Directory:**
   ```bash
   cd "Student Mangement System"
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create or verify `.env` (a pre-configured `.env` is already provided):
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/sms_db
   JWT_SECRET=sms_super_secret_jwt_key_2026_btech_project
   JWT_EXPIRE=24h
   NODE_ENV=development
   ```

4. **Seed Sample Data (Optional, runs automatically if empty):**
   ```bash
   npm run seed
   ```

5. **Start the Server:**
   ```bash
   npm start
   ```

6. **Open in Browser:**
   Visit [http://localhost:5000](http://localhost:5000)

> **Note on MongoDB:** If MongoDB is running locally or a MongoDB Atlas URI is provided in `.env`, SMS connects to MongoDB via Mongoose. If MongoDB is not running on your computer, the application automatically uses its integrated local file storage (`data/sms_data.json`) so you can test every single feature immediately without installing MongoDB!

---

## 7. API Specification Summary

All `/api/*` endpoints except `/api/auth/login` require the `Authorization: Bearer <token>` header.

| Method | Endpoint | Description | Allowed Roles |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate user and receive JWT | Public |
| `GET` | `/api/auth/me` | Fetch currently authenticated user profile | All |
| `GET` | `/api/auth/teachers` | Fetch faculty members list | Admin |
| `POST` | `/api/auth/register-teacher` | Register new faculty account | Admin |
| `GET` | `/api/students` | List students with search, filters & pagination | Admin, Teacher |
| `GET` | `/api/students/:id` | View student details & enrolled courses | Admin, Teacher, Own Student |
| `POST` | `/api/students` | Create student (with optional login account) | Admin |
| `PUT` | `/api/students/:id` | Update student details | Admin |
| `DELETE` | `/api/students/:id` | Delete student and cascade clean records | Admin |
| `GET` | `/api/courses` | List courses (with enrolled student counts) | All |
| `GET` | `/api/courses/:id` | Course details | All |
| `GET` | `/api/courses/:id/students` | List students enrolled in course | Admin, Teacher |
| `POST` | `/api/courses` | Create new course | Admin |
| `PUT` | `/api/courses/:id` | Update course / reassign instructor | Admin |
| `DELETE` | `/api/courses/:id` | Delete course and cascade clean records | Admin |
| `POST` | `/api/attendance` | Batch upsert attendance for a course & date | Admin, Teacher (Assigned) |
| `GET` | `/api/attendance` | Query attendance history with filters | Admin, Teacher, Own Student |
| `GET` | `/api/attendance/check` | Check if attendance is already recorded | Admin, Teacher |
| `GET` | `/api/attendance/summary` | Subject-wise & student-wise percentage stats | All (Student: Own Only) |
| `POST` | `/api/marks` | Batch submit marks for Assignment/Internal/Semester | Admin, Teacher (Assigned) |
| `GET` | `/api/marks` | Query marks with filters | Admin, Teacher, Own Student |
| `GET` | `/api/marks/course-sheet` | Load course roster for grade entry | Admin, Teacher |
| `GET` | `/api/marks/student/:id` | Calculated result, GPA & pass/fail | Admin, Teacher, Own Student |
| `GET` | `/api/dashboard/stats` | Role-specific dynamic dashboard analytics | All |
| `GET` | `/api/reports/student/:id` | Complete academic transcript data | Admin, Teacher, Own Student |
| `GET` | `/api/reports/class` | Class performance report by course & semester | Admin, Teacher |

---

## 8. Academic Project Report Structure (~40 Pages)

This project has been structured according to standard university BTech CSE Mini Project guidelines:

1. **Chapter 1: Introduction** — Problem statement, manual register limitations, project goals, and scope.
2. **Chapter 2: Literature Survey** — Analysis of existing ERP systems, comparative study of spreadsheet-based tracking vs centralized web applications.
3. **Chapter 3: System Requirements** — Software & hardware requirements, functional requirements (FR-1 to FR-7), non-functional requirements (security, responsiveness, data integrity).
4. **Chapter 4: System Analysis and Design** — Architecture diagram, Use-Case diagram, Data Flow Diagrams (Level 0, Level 1), Entity-Relationship (ER) diagram, and MongoDB collection schemas.
5. **Chapter 5: Implementation Details** — MVC architecture, JWT authentication flow, Mongoose models, Express routing, REST API controllers, and frontend DOM manipulation.
6. **Chapter 6: Testing & Verification** — Unit testing, API validation (boundary test for negative marks and marks exceeding maximum), attendance upsert duplicate prevention, role authorization tests, and UI responsiveness.
7. **Chapter 7: Conclusion & Future Scope** — Summary of achievements, direct PDF server generation, timetable scheduling, and SMS/email notifications.

---

## 9. License

This project is developed as part of the BTech Computer Science & Engineering curriculum and is licensed under the **MIT License**.

