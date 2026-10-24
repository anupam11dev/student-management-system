/**
 * Dashboard Logic - Role-aware data rendering
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.smsAuth.requireAuth()) return;

  const user = window.smsAuth.getUser();
  const welcomeText = document.getElementById('welcome-heading');
  if (welcomeText) {
    welcomeText.textContent = `Welcome back, ${user.name}!`;
  }

  loadDashboardData();
});

const loadDashboardData = async () => {
  const container = document.getElementById('dashboard-content');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">⏳</div>
      <div>Loading dashboard data...</div>
    </div>
  `;

  try {
    const data = await window.smsAuth.apiRequest('/api/dashboard/stats');
    if (!data.success) throw new Error(data.message);

    if (data.role === 'admin') {
      renderAdminDashboard(data.stats, container);
    } else if (data.role === 'teacher') {
      renderTeacherDashboard(data.stats, container);
    } else if (data.role === 'student') {
      renderStudentDashboard(data.stats, container);
    }
  } catch (error) {
    container.innerHTML = `
      <div class="card" style="border-left: 4px solid var(--danger);">
        <h3 style="color: var(--danger); margin-bottom: 0.5rem;">Failed to load dashboard</h3>
        <p style="color: var(--text-muted);">${error.message}</p>
        <button class="btn btn-secondary btn-sm" style="margin-top: 1rem;" onclick="loadDashboardData()">Try Again</button>
      </div>
    `;
  }
};

const getTimeGreeting = () => {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * 1. Admin Dashboard Renderer
 */
const renderAdminDashboard = (stats, container) => {
  const user = window.smsAuth.getUser();
  const { totalStudents, totalCourses, totalTeachers, todayAttendance, averageMarksPercentage, recentAttendance, recentMarks } = stats;

  const attPercent = todayAttendance.percentage || 0;
  const attClass = attPercent >= 75 ? 'green' : (attPercent >= 50 ? 'amber' : 'red');

  container.innerHTML = `
    <!-- Hero Banner with Quick Actions -->
    <div class="hero-banner">
      <div>
        <div class="hero-greeting">
          <span>👋 ${getTimeGreeting()}, ${user.name}!</span>
        </div>
        <p class="hero-subtitle">
          Welcome to the SMS Institutional Control Dashboard. Monitor campus-wide attendance, curricular records, and faculty grading in real time.
        </p>
      </div>
      <div class="hero-actions">
        <a href="students.html" class="btn-hero">➕ Add Student</a>
        <a href="courses.html" class="btn-hero">📚 Manage Courses</a>
        <a href="reports.html" class="btn-hero">📑 Generate Reports</a>
      </div>
    </div>

    <!-- Top Stat Cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon blue">🎓</div>
        <div class="stat-details">
          <div class="stat-value">${totalStudents}</div>
          <div class="stat-label">Total Active Students</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon indigo">📚</div>
        <div class="stat-details">
          <div class="stat-value">${totalCourses}</div>
          <div class="stat-label">Total Courses Offered</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon green">👨‍🏫</div>
        <div class="stat-details">
          <div class="stat-value">${totalTeachers}</div>
          <div class="stat-label">Faculty Members</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon amber">📈</div>
        <div class="stat-details">
          <div class="stat-value">${averageMarksPercentage}%</div>
          <div class="stat-label">Institute Avg Marks</div>
        </div>
      </div>
    </div>

    <!-- Attendance Summary Card -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📅 Today's Attendance Overview (${todayAttendance.date})</div>
          <div class="card-subtitle">Real-time status of marked attendance across courses today</div>
        </div>
        <a href="attendance.html" class="btn btn-primary btn-sm">Manage Attendance</a>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; align-items: center;">
        <div>
          <div style="font-size: 2.5rem; font-weight: 800; color: var(--text-main);">${attPercent}%</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">Overall Daily Presence Rate</div>
          <div class="progress-container" style="height: 10px; margin-top: 0.5rem;">
            <div class="progress-bar ${attClass}" style="width: ${attPercent}%;"></div>
          </div>
        </div>
        <div style="display: flex; gap: 2rem;">
          <div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${todayAttendance.present}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Students Present</div>
          </div>
          <div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger);">${todayAttendance.absent}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Students Absent</div>
          </div>
          <div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-main);">${todayAttendance.totalMarked}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Total Recorded</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity Grids -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem;">
      <!-- Recent Attendance -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🕒 Recent Attendance Submissions</div>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${recentAttendance.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No records yet</td></tr>' :
                recentAttendance.map(a => `
                  <tr>
                    <td><strong>${a.studentId ? a.studentId.name : 'Unknown'}</strong></td>
                    <td><span class="badge badge-neutral">${a.courseId ? a.courseId.code : 'N/A'}</span></td>
                    <td>
                      <span class="badge ${a.status === 'Present' ? 'badge-present' : 'badge-absent'}">
                        ${a.status}
                      </span>
                    </td>
                    <td style="color: var(--text-muted); font-size: 0.85rem;">${a.date}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent Marks -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📝 Latest Examination Marks</div>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Exam</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              ${recentMarks.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No records yet</td></tr>' :
                recentMarks.map(m => `
                  <tr>
                    <td><strong>${m.studentId ? m.studentId.name : 'Unknown'}</strong></td>
                    <td><span class="badge badge-neutral">${m.courseId ? m.courseId.code : 'N/A'}</span></td>
                    <td><span class="badge badge-info">${m.examType}</span></td>
                    <td><strong>${m.obtainedMarks} / ${m.maxMarks}</strong></td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
};

/**
 * 2. Teacher Dashboard Renderer
 */
const renderTeacherDashboard = (stats, container) => {
  const user = window.smsAuth.getUser();
  const { assignedCoursesCount, totalStudents, pendingAttendanceToday, todayStr, courses } = stats;

  container.innerHTML = `
    <!-- Hero Banner with Quick Actions -->
    <div class="hero-banner" style="background: linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%); box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.35);">
      <div>
        <div class="hero-greeting">
          <span>👨‍🏫 ${getTimeGreeting()}, Prof. ${user.name}!</span>
        </div>
        <p class="hero-subtitle">
          Faculty Academic Portal. Take daily classroom attendance, record assessment marks, and review student transcripts.
        </p>
      </div>
      <div class="hero-actions">
        <a href="attendance.html" class="btn-hero">📅 Mark Today's Attendance</a>
        <a href="marks.html" class="btn-hero">📝 Enter Exam Marks</a>
        <a href="courses.html" class="btn-hero">➕ Add Course</a>
      </div>
    </div>

    <!-- Top Stat Cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon indigo">📚</div>
        <div class="stat-details">
          <div class="stat-value">${assignedCoursesCount}</div>
          <div class="stat-label">Assigned Courses</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon blue">🎓</div>
        <div class="stat-details">
          <div class="stat-value">${totalStudents}</div>
          <div class="stat-label">Enrolled Students</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon ${pendingAttendanceToday > 0 ? 'amber' : 'green'}">
          ${pendingAttendanceToday > 0 ? '⚠️' : '✅'}
        </div>
        <div class="stat-details">
          <div class="stat-value">${pendingAttendanceToday}</div>
          <div class="stat-label">Pending Today's Attendance</div>
        </div>
      </div>
    </div>

    <!-- Quick Action Banner -->
    <div class="card" style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-color: #bfdbfe;">
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem;">
        <div>
          <h3 style="color: #1e40af; margin-bottom: 0.25rem;">Daily Faculty Routine</h3>
          <p style="color: #3b82f6; font-size: 0.9rem;">Quickly mark today's class attendance and enter exam scores.</p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <a href="attendance.html" class="btn btn-primary">Mark Attendance Now</a>
          <a href="marks.html" class="btn btn-secondary">Enter Student Marks</a>
        </div>
      </div>
    </div>

    <!-- Assigned Courses Status Table -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📚 Your Assigned Courses</div>
          <div class="card-subtitle">Daily attendance status for ${todayStr}</div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Name</th>
              <th>Semester</th>
              <th>Today's Attendance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${courses.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No courses assigned to you yet.</td></tr>' :
              courses.map(c => `
                <tr>
                  <td><strong>${c.code}</strong></td>
                  <td>${c.name}</td>
                  <td>Semester ${c.semester}</td>
                  <td>
                    ${c.todayAttendanceMarked
                      ? '<span class="badge badge-success">✅ Marked for Today</span>'
                      : '<span class="badge badge-warning">⏳ Pending for Today</span>'
                    }
                  </td>
                  <td>
                    <div style="display: flex; gap: 0.5rem;">
                      <a href="attendance.html?courseId=${c.id}" class="btn btn-primary btn-sm">Take Attendance</a>
                      <a href="marks.html?courseId=${c.id}" class="btn btn-secondary btn-sm">Marks</a>
                    </div>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
};

/**
 * 3. Student Dashboard Renderer
 */
const renderStudentDashboard = (stats, container) => {
  const { student, enrolledCoursesCount, attendance, marks, recentMarks } = stats;

  if (!student) {
    container.innerHTML = `<div class="card"><p>No student profile found.</p></div>`;
    return;
  }

  const attPercent = attendance.percentage;
  const isLowAtt = attendance.isLowAttendance;
  const attClass = attPercent >= 75 ? 'green' : (attPercent >= 50 ? 'amber' : 'red');

  container.innerHTML = `
    <!-- Student Hero Banner -->
    <div class="hero-banner" style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); box-shadow: 0 10px 25px -5px rgba(67, 56, 202, 0.35);">
      <div>
        <div class="hero-greeting">
          <span>🎓 ${getTimeGreeting()}, ${student.name}!</span>
        </div>
        <p class="hero-subtitle">
          Roll No: <strong style="color: #ffffff;">${student.rollNumber}</strong> • Program: <strong style="color: #ffffff;">${student.courseName}</strong> • Semester: <strong style="color: #ffffff;">${student.semester}</strong>
        </p>
      </div>
      <div class="hero-actions">
        <a href="reports.html" class="btn-hero">📑 View Official Transcript</a>
        <a href="attendance.html" class="btn-hero">📅 My Attendance</a>
        <a href="marks.html" class="btn-hero">📝 My Results</a>
      </div>
    </div>

    <!-- Threshold Alert Banner if < 75% -->
    ${isLowAtt ? `
      <div class="card" style="background-color: #fef2f2; border: 1px solid #fecaca; margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="font-size: 2rem;">⚠️</div>
          <div>
            <h4 style="color: #991b1b; font-weight: 700;">Attendance Warning Alert</h4>
            <p style="color: #b91c1c; font-size: 0.88rem; margin-top: 0.2rem;">
              Your current attendance is <strong>${attPercent}%</strong>, which is below the mandatory institute requirement of <strong>75%</strong>. Please attend scheduled lectures to avoid exam debarment.
            </p>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Stat Cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon ${isLowAtt ? 'red' : 'green'}">📅</div>
        <div class="stat-details">
          <div class="stat-value" style="${isLowAtt ? 'color: var(--danger);' : ''}">
            ${attPercent}%
          </div>
          <div class="stat-label">Overall Attendance (${attendance.attended} / ${attendance.totalClasses} classes)</div>
          <div class="progress-container">
            <div class="progress-bar ${attClass}" style="width: ${attPercent}%;"></div>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon blue">📝</div>
        <div class="stat-details">
          <div class="stat-value">${marks.percentage}%</div>
          <div class="stat-label">Cumulative Exam Score (${marks.totalObtained} / ${marks.totalMax})</div>
          <div class="progress-container">
            <div class="progress-bar green" style="width: ${marks.percentage}%;"></div>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon indigo">📚</div>
        <div class="stat-details">
          <div class="stat-value">${enrolledCoursesCount}</div>
          <div class="stat-label">Courses This Semester</div>
        </div>
      </div>
    </div>

    <!-- Recent Marks / Results Preview -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📝 Recent Academic Results</div>
          <div class="card-subtitle">Your latest marks entries across subjects</div>
        </div>
        <a href="marks.html" class="btn btn-secondary btn-sm">All Marks & Results</a>
      </div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Exam Type</th>
              <th>Marks Scored</th>
              <th>Max Marks</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${recentMarks.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No marks recorded yet.</td></tr>' :
              recentMarks.map(m => {
                const pct = Math.round((m.obtainedMarks / m.maxMarks) * 1000) / 10;
                return `
                  <tr>
                    <td><strong>${m.courseId ? m.courseId.name : 'Course'} (${m.courseId ? m.courseId.code : ''})</strong></td>
                    <td><span class="badge badge-info">${m.examType}</span></td>
                    <td><strong>${m.obtainedMarks}</strong></td>
                    <td>${m.maxMarks}</td>
                    <td>
                      <span class="badge ${pct >= 40 ? 'badge-success' : 'badge-danger'}">${pct}%</span>
                    </td>
                  </tr>
                `;
              }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
};

