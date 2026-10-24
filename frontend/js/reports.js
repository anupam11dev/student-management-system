/**
 * Academic Reports and Transcript Logic
 */

let allStudents = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.smsAuth.requireAuth()) return;

  const user = window.smsAuth.getUser();

  if (user.role === 'student') {
    // Student: Lock to own report
    document.getElementById('report-controls-card')?.remove();
    document.getElementById('report-tabs')?.remove();
    document.getElementById('class-report-content')?.remove();
    loadStudentTranscript(user.linkedStudentId);
  } else {
    // Admin / Teacher
    setupEventListeners();
    await loadStudentList();
  }
});

const setupEventListeners = () => {
  document.getElementById('tab-individual-report')?.addEventListener('click', () => switchTab('individual'));
  document.getElementById('tab-class-report')?.addEventListener('click', () => {
    switchTab('class');
    loadClassReport();
  });

  document.getElementById('report-student-select')?.addEventListener('change', (e) => {
    if (e.target.value) {
      loadStudentTranscript(e.target.value);
    }
  });

  document.getElementById('class-filter-course')?.addEventListener('change', loadClassReport);
  document.getElementById('class-filter-semester')?.addEventListener('change', loadClassReport);

  document.getElementById('btn-print-transcript')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btn-print-class-report')?.addEventListener('click', () => {
    window.print();
  });
};

const switchTab = (tab) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

  if (tab === 'individual') {
    document.getElementById('tab-individual-report')?.classList.add('active');
    document.getElementById('individual-report-content').style.display = 'block';
  } else if (tab === 'class') {
    document.getElementById('tab-class-report')?.classList.add('active');
    document.getElementById('class-report-content').style.display = 'block';
  }
};

const loadStudentList = async () => {
  const select = document.getElementById('report-student-select');
  if (!select) return;

  try {
    const res = await window.smsAuth.apiRequest('/api/students?limit=100');
    if (res.success) {
      allStudents = res.students;
      select.innerHTML = '<option value="">-- Select a Student --</option>' +
        allStudents.map(s => `<option value="${s._id}">${s.rollNumber} - ${s.name} (Sem ${s.semester})</option>`).join('');

      // Auto-select if passed in URL query param
      const urlParams = new URLSearchParams(window.location.search);
      const qStudentId = urlParams.get('studentId');
      if (qStudentId) {
        select.value = qStudentId;
        loadStudentTranscript(qStudentId);
      } else if (allStudents.length > 0) {
        select.selectedIndex = 1;
        loadStudentTranscript(allStudents[0]._id);
      }
    }
  } catch (error) {
    console.error('Failed to load students list:', error);
  }
};

/**
 * Load and Render Comprehensive Student Transcript (FR-7.1 & FR-7.3)
 */
const loadStudentTranscript = async (studentId) => {
  const container = document.getElementById('transcript-container');
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-muted);">Generating official academic transcript...</div>';

  try {
    const res = await window.smsAuth.apiRequest(`/api/reports/student/${studentId}`);
    if (!res.success) throw new Error(res.message);

    const { student, academicYear, generatedDate, overallAttendance, overallPerformance, subjects } = res.report;
    const isPass = overallPerformance.status === 'PASS';

    container.innerHTML = `
      <div class="card" style="padding: 2.5rem; background: white; border: 1px solid #cbd5e1; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 2rem;">
        
        <!-- Official College Letterhead Header -->
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
          <div style="font-size: 2.25rem; margin-bottom: 0.25rem;">🎓</div>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: #1e3a8a; letter-spacing: 0.02em; text-transform: uppercase;">
            Apex Institute of Technology & Science
          </h2>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">
            Affiliated to State Technological University • Approved by AICTE, New Delhi
          </div>
          <div style="margin-top: 0.75rem; display: inline-block; background-color: #f1f5f9; padding: 0.35rem 1.25rem; border-radius: var(--radius-full); font-weight: 700; font-size: 0.85rem; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">
            Official Student Academic Transcript & Performance Record
          </div>
        </div>

        <!-- Student Biographical Metadata Block -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; font-size: 0.9rem;">
          <div>
            <span style="color: var(--text-muted); display: block; font-size: 0.78rem; text-transform: uppercase; font-weight: 600;">Student Full Name</span>
            <strong style="color: var(--text-main); font-size: 1.05rem;">${student.name}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block; font-size: 0.78rem; text-transform: uppercase; font-weight: 600;">University Roll Number</span>
            <strong style="color: var(--primary); font-size: 1.05rem;">${student.rollNumber}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block; font-size: 0.78rem; text-transform: uppercase; font-weight: 600;">Degree Program / Branch</span>
            <strong>${student.courseName}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block; font-size: 0.78rem; text-transform: uppercase; font-weight: 600;">Current Semester</span>
            <strong>Semester ${student.semester} (Section ${student.section || 'A'})</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block; font-size: 0.78rem; text-transform: uppercase; font-weight: 600;">Academic Session</span>
            <strong>${academicYear}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block; font-size: 0.78rem; text-transform: uppercase; font-weight: 600;">Date of Issue</span>
            <strong>${generatedDate}</strong>
          </div>
        </div>

        <!-- Section 1: Combined Attendance Record (FR-7.1) -->
        <div style="margin-bottom: 1.75rem;">
          <h4 style="font-size: 1.05rem; font-weight: 700; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.4rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
            <span>1. ATTENDANCE RECORD</span>
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Required Threshold: 75%</span>
          </h4>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; background: #fafafa; border: 1px solid #e5e7eb; border-radius: var(--radius-sm); padding: 1rem;">
            <div>
              <span style="color: var(--text-muted); font-size: 0.8rem;">Lectures Conducted:</span>
              <div style="font-size: 1.25rem; font-weight: 700;">${overallAttendance.totalClasses}</div>
            </div>
            <div>
              <span style="color: var(--text-muted); font-size: 0.8rem;">Lectures Attended:</span>
              <div style="font-size: 1.25rem; font-weight: 700; color: var(--success);">${overallAttendance.attended}</div>
            </div>
            <div>
              <span style="color: var(--text-muted); font-size: 0.8rem;">Attendance Percentage:</span>
              <div style="font-size: 1.25rem; font-weight: 800; color: ${overallAttendance.isLowAttendance ? 'var(--danger)' : 'var(--text-main)'};">
                ${overallAttendance.percentage}%
              </div>
            </div>
            <div>
              <span style="color: var(--text-muted); font-size: 0.8rem;">Examination Clearance:</span>
              <div>
                ${overallAttendance.isLowAttendance
                  ? '<span class="badge badge-danger">⚠️ Debarred (< 75%)</span>'
                  : '<span class="badge badge-success">✅ Eligible for Exams</span>'
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Subject-wise Academic Marks & Result (FR-7.1) -->
        <div style="margin-bottom: 1.75rem;">
          <h4 style="font-size: 1.05rem; font-weight: 700; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.4rem; margin-bottom: 0.75rem;">
            2. COURSE EVALUATION & GRADE STATEMENT
          </h4>

          <div class="table-responsive">
            <table class="table" style="font-size: 0.88rem;">
              <thead>
                <tr>
                  <th>Course Code & Title</th>
                  <th>Credits</th>
                  <th>Faculty Instructor</th>
                  <th>Attendance</th>
                  <th>Assignment (20)</th>
                  <th>Internal (30)</th>
                  <th>Semester End (100)</th>
                  <th>Total Marks</th>
                  <th>Grade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${subjects.length === 0 ? '<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">No courses recorded.</td></tr>' :
                  subjects.map(s => {
                    const asgn = s.exams['Assignment'] ? s.exams['Assignment'].obtained : '--';
                    const intr = s.exams['Internal'] ? s.exams['Internal'].obtained : '--';
                    const sem = s.exams['Semester'] ? s.exams['Semester'].obtained : '--';

                    return `
                      <tr>
                        <td>
                          <strong>${s.courseCode}</strong>
                          <div style="font-size: 0.8rem; color: #475569;">${s.courseName}</div>
                        </td>
                        <td><strong>${s.credits}</strong></td>
                        <td style="font-size: 0.8rem; color: #475569;">${s.instructor}</td>
                        <td>
                          <span style="font-weight: 600; color: ${s.attendance.isLowAttendance ? 'var(--danger)' : 'inherit'};">
                            ${s.attendance.percentage}%
                          </span>
                        </td>
                        <td>${asgn}</td>
                        <td>${intr}</td>
                        <td>${sem}</td>
                        <td>
                          <strong>${s.marks.totalObtained} / ${s.marks.totalMax}</strong>
                          <div style="font-size: 0.75rem; color: var(--text-muted);">${s.marks.percentage}%</div>
                        </td>
                        <td>
                          <strong style="font-size: 0.95rem;">${s.grade}</strong>
                        </td>
                        <td>
                          <span class="badge ${s.status === 'PASS' ? 'badge-success' : (s.status === 'FAIL' ? 'badge-danger' : 'badge-neutral')}">
                            ${s.status}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 3: Overall Cumulative Summary Box -->
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%); border: 2px solid #cbd5e1; border-radius: var(--radius-md); padding: 1.25rem 1.5rem; margin-bottom: 2rem;">
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1.5rem;">
            <div>
              <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: #64748b;">Cumulative Performance</div>
              <div style="font-size: 1.85rem; font-weight: 800; color: #0f172a; margin-top: 0.2rem;">
                ${overallPerformance.totalObtained} <span style="font-size: 1.1rem; font-weight: 500; color: #64748b;">/ ${overallPerformance.totalMax} Marks</span>
              </div>
            </div>

            <div>
              <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: #64748b;">Grand Percentage</div>
              <div style="font-size: 1.85rem; font-weight: 800; color: var(--primary); margin-top: 0.2rem;">
                ${overallPerformance.percentage}%
              </div>
            </div>

            <div>
              <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: #64748b;">Calculated SGPA</div>
              <div style="font-size: 1.85rem; font-weight: 800; color: #059669; margin-top: 0.2rem;">
                ${overallPerformance.sgpa} <span style="font-size: 0.9rem; font-weight: 500; color: #64748b;">/ 10.0</span>
              </div>
            </div>

            <div>
              <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: #64748b;">Final Evaluation</div>
              <div style="margin-top: 0.2rem;">
                <span class="badge ${isPass ? 'badge-success' : 'badge-danger'}" style="font-size: 1rem; padding: 0.4rem 1.25rem; font-weight: 800;">
                  ${overallPerformance.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Official Signatures Block (For Print layout) -->
        <div class="print-signatures" style="display: flex; justify-content: space-between; margin-top: 3.5rem; padding: 0 1rem;">
          <div style="text-align: center; border-top: 1.5px solid #0f172a; padding-top: 0.5rem; min-width: 180px;">
            <div style="font-weight: 700; font-size: 0.85rem;">Class Mentor / Teacher</div>
            <div style="font-size: 0.75rem; color: #64748b;">Verification of Attendance</div>
          </div>

          <div style="text-align: center; border-top: 1.5px solid #0f172a; padding-top: 0.5rem; min-width: 180px;">
            <div style="font-weight: 700; font-size: 0.85rem;">Head of Department (CSE)</div>
            <div style="font-size: 0.75rem; color: #64748b;">Departmental Endorsement</div>
          </div>

          <div style="text-align: center; border-top: 1.5px solid #0f172a; padding-top: 0.5rem; min-width: 180px;">
            <div style="font-weight: 700; font-size: 0.85rem;">Controller of Examinations</div>
            <div style="font-size: 0.75rem; color: #64748b;">Official Institutional Seal</div>
          </div>
        </div>

      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="card" style="color: var(--danger); padding: 2rem;">Failed to load transcript: ${error.message}</div>`;
  }
};

/**
 * Load and Render Class Performance Overview (FR-7.2)
 */
const loadClassReport = async () => {
  const container = document.getElementById('class-report-tbody');
  const courseName = document.getElementById('class-filter-course')?.value || '';
  const semester = document.getElementById('class-filter-semester')?.value || '';

  if (!container) return;
  container.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Generating class-level summary...</td></tr>';

  try {
    const query = new URLSearchParams();
    if (courseName) query.append('courseName', courseName);
    if (semester) query.append('semester', semester);

    const res = await window.smsAuth.apiRequest(`/api/reports/class?${query.toString()}`);
    if (!res.success) throw new Error(res.message);

    const students = res.students;
    document.getElementById('class-report-count').textContent = `Total Enrolled: ${res.totalStudents} Students`;

    if (students.length === 0) {
      container.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No student records found for the selected filters.</td></tr>';
      return;
    }

    container.innerHTML = students.map(s => {
      const isLow = s.isLowAttendance;
      const isPass = s.status === 'PASS';

      return `
        <tr class="${isLow ? 'attendance-warning-row' : ''}">
          <td>
            <strong style="color: var(--primary);">${s.rollNumber}</strong>
          </td>
          <td>
            <div style="font-weight: 600;">${s.name}</div>
          </td>
          <td>
            ${s.courseName} (Sem ${s.semester})
          </td>
          <td>
            <strong style="color: ${isLow ? 'var(--danger)' : 'inherit'};">${s.attendancePercentage}%</strong>
            ${isLow ? '<span class="attendance-alert-chip" style="margin-left: 0.4rem;">Low</span>' : ''}
          </td>
          <td>
            <strong>${s.marksPercentage}%</strong>
          </td>
          <td>
            <span class="badge badge-neutral" style="font-weight: 800;">${s.grade}</span>
          </td>
          <td>
            <span class="badge ${isPass ? 'badge-success' : (s.status === 'FAIL' ? 'badge-danger' : 'badge-neutral')}">
              ${s.status}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    container.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">${error.message}</td></tr>`;
  }
};

