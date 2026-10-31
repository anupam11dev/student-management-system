/**
 * Marks and Result Management Logic
 */

let courseStudents = [];
let assignedCourses = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.smsAuth.requireAuth()) return;

  const user = window.smsAuth.getUser();

  if (user.role === 'student') {
    // Hide teacher entry tab and show personal results
    document.getElementById('tab-enter-marks-btn')?.remove();
    document.getElementById('tab-enter-marks-content')?.remove();
    document.getElementById('marks-tab-nav')?.remove();
    document.getElementById('student-results-view').style.display = 'block';
    loadStudentPersonalMarks();
  } else {
    // Admin or Teacher
    await loadCoursesDropdown();
    setupEventListeners();
    switchTab('enter');
  }
});

const setupEventListeners = () => {
  document.getElementById('tab-enter-marks-btn')?.addEventListener('click', () => switchTab('enter'));
  document.getElementById('tab-view-results-btn')?.addEventListener('click', () => {
    switchTab('view');
    loadStudentSelectorForResults();
  });

  document.getElementById('marks-course-select')?.addEventListener('change', loadCourseSheet);
  document.getElementById('marks-exam-type')?.addEventListener('change', (e) => {
    updateDefaultMaxMarks(e.target.value);
    loadCourseSheet();
  });

  document.getElementById('default-max-marks')?.addEventListener('input', (e) => {
    updateAllMaxMarks(e.target.value);
  });

  document.getElementById('marks-entry-form')?.addEventListener('submit', handleMarksSubmit);

  document.getElementById('result-student-select')?.addEventListener('change', (e) => {
    if (e.target.value) {
      loadStudentResultSummary(e.target.value);
    }
  });
};

const switchTab = (tab) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

  if (tab === 'enter') {
    document.getElementById('tab-enter-marks-btn')?.classList.add('active');
    document.getElementById('tab-enter-marks-content').style.display = 'block';
  } else if (tab === 'view') {
    document.getElementById('tab-view-results-btn')?.classList.add('active');
    document.getElementById('tab-view-results-content').style.display = 'block';
  }
};

const updateDefaultMaxMarks = (examType) => {
  const maxInput = document.getElementById('default-max-marks');
  if (!maxInput) return;

  if (examType === 'Assignment') {
    maxInput.value = 20;
  } else if (examType === 'Internal') {
    maxInput.value = 30;
  } else if (examType === 'Semester') {
    maxInput.value = 100;
  }
  updateAllMaxMarks(maxInput.value);
};

const updateAllMaxMarks = (newMax) => {
  const maxInputs = document.querySelectorAll('.max-marks-input');
  maxInputs.forEach(input => {
    input.value = newMax;
  });
  // Recalculate row percentages
  document.querySelectorAll('.obtained-marks-input').forEach(input => {
    calculateRowPercentage(input);
  });
};

const loadCoursesDropdown = async () => {
  try {
    const user = window.smsAuth.getUser();
    const url = user.role === 'teacher' ? '/api/courses?mine=true' : '/api/courses';
    const res = await window.smsAuth.apiRequest(url);

    if (res.success) {
      assignedCourses = res.courses;
      const select = document.getElementById('marks-course-select');
      if (select) {
        if (assignedCourses.length === 0) {
          select.innerHTML = '<option value="">-- No Courses Available --</option>';
        } else {
          select.innerHTML = '<option value="">-- Select Course --</option>' +
            assignedCourses.map(c => `<option value="${c._id}">${c.code} - ${c.name} (Sem ${c.semester})</option>`).join('');

          // Auto select the first course with students or the direct query value if present.
          const urlParams = new URLSearchParams(window.location.search);
          const qId = urlParams.get('courseId');
          const preferredCourse = assignedCourses.find(c => Number(c.studentCount || 0) > 0) || assignedCourses[0];
          if (qId) {
            select.value = qId;
          } else if (preferredCourse) {
            select.value = preferredCourse._id;
          } else {
            select.selectedIndex = 1;
          }
          loadCourseSheet();
        }
      }
    }
  } catch (error) {
    window.smsAuth.showToast('Failed to load courses: ' + error.message, 'danger');
  }
};

const loadCourseSheet = async () => {
  const courseId = document.getElementById('marks-course-select')?.value;
  const examType = document.getElementById('marks-exam-type')?.value || 'Assignment';
  const defaultMax = parseFloat(document.getElementById('default-max-marks')?.value) || 20;
  const tableBody = document.getElementById('marks-entry-tbody');
  const submitBtn = document.getElementById('save-marks-btn');

  if (!courseId) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">Please select a course to begin entering marks.</td></tr>';
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading student score sheet...</td></tr>';
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await window.smsAuth.apiRequest(`/api/marks/course-sheet?courseId=${courseId}&examType=${examType}`);
    if (!res.success) throw new Error(res.message);

    courseStudents = res.students;

    if (courseStudents.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No students enrolled in this course semester.</td></tr>';
      return;
    }

    tableBody.innerHTML = courseStudents.map(s => {
      const sId = String(s._id);
      const existingExamMarks = s.marks && s.marks[examType];
      const obtainedVal = existingExamMarks ? existingExamMarks.obtainedMarks : '';
      const maxVal = existingExamMarks ? existingExamMarks.maxMarks : defaultMax;
      const remarks = existingExamMarks ? (existingExamMarks.remarks || '') : '';

      const pct = obtainedVal !== '' ? Math.round((parseFloat(obtainedVal) / parseFloat(maxVal)) * 1000) / 10 : null;
      const statusBadge = pct !== null
        ? (pct >= 40 ? '<span class="badge badge-success">PASS</span>' : '<span class="badge badge-danger">FAIL</span>')
        : '<span class="badge badge-neutral">--</span>';

      return `
        <tr id="row_${sId}">
          <td>
            <strong style="color: var(--primary);">${s.rollNumber}</strong>
          </td>
          <td>
            <div style="font-weight: 600;">${s.name}</div>
          </td>
          <td>
            <input type="number" step="0.5" min="0" 
                   id="obtained_${sId}" 
                   class="form-control obtained-marks-input" 
                   style="max-width: 120px; font-weight: 700;" 
                   value="${obtainedVal}" 
                   placeholder="e.g. 18"
                   oninput="calculateRowPercentage(this, '${sId}')">
          </td>
          <td>
            <input type="number" step="0.5" min="1" 
                   id="max_${sId}" 
                   class="form-control max-marks-input" 
                   style="max-width: 100px;" 
                   value="${maxVal}" 
                   oninput="calculateRowPercentage(this, '${sId}')">
          </td>
          <td>
            <span id="pct_${sId}" style="font-weight: 700; color: var(--text-main);">${pct !== null ? pct + '%' : '--'}</span>
          </td>
          <td>
            <span id="badge_${sId}">${statusBadge}</span>
          </td>
        </tr>
      `;
    }).join('');

    submitBtn.disabled = false;
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 2rem;">${error.message}</td></tr>`;
    if (submitBtn) submitBtn.disabled = true;
  }
};

const calculateRowPercentage = (inputEl, sId) => {
  if (!sId) {
    sId = inputEl.id.replace('obtained_', '').replace('max_', '');
  }

  const obtainedInput = document.getElementById(`obtained_${sId}`);
  const maxInput = document.getElementById(`max_${sId}`);
  const pctEl = document.getElementById(`pct_${sId}`);
  const badgeEl = document.getElementById(`badge_${sId}`);

  if (!obtainedInput || !maxInput) return;

  const obtained = parseFloat(obtainedInput.value);
  const max = parseFloat(maxInput.value);

  // Validation: FR-5.2 numeric, non-negative, not above maximum marks
  if (isNaN(obtained)) {
    pctEl.textContent = '--';
    badgeEl.innerHTML = '<span class="badge badge-neutral">--</span>';
    obtainedInput.style.borderColor = 'var(--border-color)';
    return;
  }

  if (obtained < 0 || obtained > max) {
    obtainedInput.style.borderColor = 'var(--danger)';
    pctEl.textContent = 'Invalid!';
    badgeEl.innerHTML = '<span class="badge badge-danger">Out of range</span>';
    return;
  }

  obtainedInput.style.borderColor = 'var(--border-color)';
  const percentage = Math.round((obtained / max) * 1000) / 10;
  pctEl.textContent = `${percentage}%`;

  let gradeBadge = '';
  if (percentage >= 90) {
    gradeBadge = '<span class="badge badge-grade-o">Grade O (PASS)</span>';
  } else if (percentage >= 80) {
    gradeBadge = '<span class="badge badge-grade-a">Grade A+ (PASS)</span>';
  } else if (percentage >= 70) {
    gradeBadge = '<span class="badge badge-grade-a">Grade A (PASS)</span>';
  } else if (percentage >= 60) {
    gradeBadge = '<span class="badge badge-grade-b">Grade B (PASS)</span>';
  } else if (percentage >= 40) {
    gradeBadge = '<span class="badge badge-success">Grade C (PASS)</span>';
  } else {
    gradeBadge = '<span class="badge badge-danger">Grade F (FAIL)</span>';
  }
  badgeEl.innerHTML = gradeBadge;
};

const handleMarksSubmit = async (e) => {
  e.preventDefault();
  const courseId = document.getElementById('marks-course-select').value;
  const examType = document.getElementById('marks-exam-type').value;
  const submitBtn = document.getElementById('save-marks-btn');

  if (!courseId || !examType) {
    window.smsAuth.showToast('Please select course and exam type.', 'warning');
    return;
  }

  const entries = [];
  let hasValidationErrors = false;

  for (const s of courseStudents) {
    const sId = String(s._id);
    const obtainedVal = document.getElementById(`obtained_${sId}`)?.value.trim();
    const maxVal = document.getElementById(`max_${sId}`)?.value.trim();

    if (obtainedVal === '' || obtainedVal === undefined) {
      continue; // Skip unmarked students
    }

    const numObtained = parseFloat(obtainedVal);
    const numMax = parseFloat(maxVal);

    if (isNaN(numObtained) || isNaN(numMax) || numObtained < 0 || numObtained > numMax) {
      hasValidationErrors = true;
      document.getElementById(`obtained_${sId}`).style.borderColor = 'var(--danger)';
    } else {
      entries.push({
        studentId: sId,
        obtainedMarks: numObtained,
        maxMarks: numMax
      });
    }
  }

  if (hasValidationErrors) {
    window.smsAuth.showToast('Please correct marks out of range (cannot be negative or exceed max marks).', 'danger');
    return;
  }

  if (entries.length === 0) {
    window.smsAuth.showToast('No student marks entered to save.', 'warning');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving Marks...';

  try {
    const res = await window.smsAuth.apiRequest('/api/marks', {
      method: 'POST',
      body: JSON.stringify({
        courseId,
        examType,
        entries
      })
    });

    window.smsAuth.showToast(res.message, 'success');
    loadCourseSheet();
  } catch (error) {
    window.smsAuth.showToast(error.message, 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Marks';
  }
};

/**
 * Student Selector for Results summary (Admin / Teacher tab)
 */
const loadStudentSelectorForResults = async () => {
  const select = document.getElementById('result-student-select');
  if (!select) return;

  try {
    const res = await window.smsAuth.apiRequest('/api/students?limit=100');
    if (res.success) {
      select.innerHTML = '<option value="">-- Choose a Student --</option>' +
        res.students.map(s => `<option value="${s._id}">${s.rollNumber} - ${s.name} (Sem ${s.semester})</option>`).join('');

      // If student was selected in query
      const urlParams = new URLSearchParams(window.location.search);
      const qStudentId = urlParams.get('studentId');
      if (qStudentId) {
        select.value = qStudentId;
        loadStudentResultSummary(qStudentId);
      }
    }
  } catch (e) {
    console.error('Failed to load students for results:', e);
  }
};

const loadStudentResultSummary = async (studentId) => {
  const container = document.getElementById('results-summary-display');
  container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Calculating result summary...</div>';

  try {
    const res = await window.smsAuth.apiRequest(`/api/marks/student/${studentId}`);
    if (!res.success) throw new Error(res.message);

    renderResultCard(res.student, res.result, container);
  } catch (error) {
    container.innerHTML = `<div style="color: var(--danger); padding: 1.5rem;">${error.message}</div>`;
  }
};

/**
 * Student Personal Results (Student Role)
 */
const loadStudentPersonalMarks = async () => {
  const container = document.getElementById('student-personal-results-display');
  container.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-muted);">Loading your academic records...</div>';

  try {
    const user = window.smsAuth.getUser();
    const res = await window.smsAuth.apiRequest(`/api/marks/student/${user.linkedStudentId}`);
    if (!res.success) throw new Error(res.message);

    renderResultCard(res.student, res.result, container);
  } catch (error) {
    container.innerHTML = `<div class="card" style="color: var(--danger);">${error.message}</div>`;
  }
};

/**
 * Common Renderer for Student Result Card
 */
const renderResultCard = (student, result, container) => {
  const isPass = result.status === 'PASS';

  container.innerHTML = `
    <!-- Top Cumulative Summary Banner -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div class="card-header">
        <div>
          <div class="card-title">Academic Result Summary</div>
          <div class="card-subtitle">${student.name} • Roll: ${student.rollNumber} • ${student.courseName} (Sem ${student.semester})</div>
        </div>
        <span class="badge ${isPass ? 'badge-success' : 'badge-danger'}" style="font-size: 0.95rem; padding: 0.4rem 1rem;">
          ${isPass ? '🎉 STATUS: PASS' : '⚠️ STATUS: FAIL / PENDING'}
        </span>
      </div>

      <div class="stat-grid" style="margin-bottom: 0;">
        <div class="stat-card">
          <div class="stat-icon blue">📊</div>
          <div class="stat-details">
            <div class="stat-value">${result.overallPercentage}%</div>
            <div class="stat-label">Cumulative Percentage</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon ${isPass ? 'green' : 'red'}">🏆</div>
          <div class="stat-details">
            <div class="stat-value">${result.grade}</div>
            <div class="stat-label">Overall Letter Grade</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon indigo">📝</div>
          <div class="stat-details">
            <div class="stat-value">${result.totalObtained} / ${result.totalMax}</div>
            <div class="stat-label">Total Marks Scored</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Subject-wise Breakdown Table -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">📚 Course-wise Examination Breakdown</div>
        <a href="reports.html?studentId=${student._id}" class="btn btn-secondary btn-sm">
          📑 Print Full Transcript
        </a>
      </div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Assignment</th>
              <th>Internal</th>
              <th>Semester Exam</th>
              <th>Total Marks</th>
              <th>Percentage</th>
              <th>Grade</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${result.subjects.length === 0 ? '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No marks recorded for this semester yet.</td></tr>' :
              result.subjects.map(sub => {
                const asgn = sub.exams['Assignment'] ? `${sub.exams['Assignment'].obtained} / ${sub.exams['Assignment'].max}` : '--';
                const intr = sub.exams['Internal'] ? `${sub.exams['Internal'].obtained} / ${sub.exams['Internal'].max}` : '--';
                const sem = sub.exams['Semester'] ? `${sub.exams['Semester'].obtained} / ${sub.exams['Semester'].max}` : '--';

                return `
                  <tr>
                    <td>
                      <strong>${sub.name}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${sub.code} (${sub.credits} Credits)</div>
                    </td>
                    <td>${asgn}</td>
                    <td>${intr}</td>
                    <td>${sem}</td>
                    <td><strong>${sub.subjectTotalObtained} / ${sub.subjectTotalMax}</strong></td>
                    <td>
                      <strong>${sub.percentage}%</strong>
                    </td>
                    <td>
                      <span class="badge badge-neutral" style="font-weight: 800;">${sub.grade}</span>
                    </td>
                    <td>
                      <span class="badge ${sub.status === 'PASS' ? 'badge-success' : 'badge-danger'}">
                        ${sub.status}
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
  `;
};

window.calculateRowPercentage = calculateRowPercentage;

