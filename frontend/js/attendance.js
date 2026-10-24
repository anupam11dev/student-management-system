/**
 * Attendance Management Logic
 */

let currentStudentsList = [];
let enrolledCoursesList = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.smsAuth.requireAuth()) return;

  const user = window.smsAuth.getUser();

  // If student role, hide Mark Attendance tab and show only Student View
  if (user.role === 'student') {
    document.getElementById('tab-mark-attendance-btn')?.remove();
    document.getElementById('tab-mark-attendance-content')?.remove();
    switchTab('summary');
    loadStudentPersonalAttendance();
  } else {
    // Admin or Teacher
    setupAttendanceDateInput();
    await loadCoursesDropdown();
    setupEventListeners();
    switchTab('mark');
  }
});

const setupAttendanceDateInput = () => {
  const dateInput = document.getElementById('attendance-date');
  if (dateInput) {
    const today = new Date().toISOString().substring(0, 10);
    dateInput.value = today;
    dateInput.max = today; // Prevent future dates (FR-4 requirement)
  }
};

const setupEventListeners = () => {
  document.getElementById('tab-mark-attendance-btn')?.addEventListener('click', () => switchTab('mark'));
  document.getElementById('tab-summary-btn')?.addEventListener('click', () => {
    switchTab('summary');
    loadAttendanceSummary();
  });

  document.getElementById('attendance-course-select')?.addEventListener('change', onCourseOrDateChange);
  document.getElementById('attendance-date')?.addEventListener('change', onCourseOrDateChange);

  document.getElementById('btn-mark-all-present')?.addEventListener('click', () => markAllStatus('Present'));
  document.getElementById('btn-mark-all-absent')?.addEventListener('click', () => markAllStatus('Absent'));

  document.getElementById('attendance-form')?.addEventListener('submit', handleAttendanceSubmit);

  // Summary filters
  document.getElementById('summary-filter-course')?.addEventListener('change', loadAttendanceSummary);
};

const switchTab = (tabName) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

  if (tabName === 'mark') {
    document.getElementById('tab-mark-attendance-btn')?.classList.add('active');
    const markContent = document.getElementById('tab-mark-attendance-content');
    if (markContent) markContent.style.display = 'block';
  } else if (tabName === 'summary') {
    document.getElementById('tab-summary-btn')?.classList.add('active');
    const sumContent = document.getElementById('tab-summary-content');
    if (sumContent) sumContent.style.display = 'block';
  }
};

const loadCoursesDropdown = async () => {
  try {
    const user = window.smsAuth.getUser();
    // If teacher, load courses assigned to this teacher
    const url = user.role === 'teacher' ? '/api/courses?mine=true' : '/api/courses';
    const res = await window.smsAuth.apiRequest(url);

    if (res.success) {
      enrolledCoursesList = res.courses;
      const select = document.getElementById('attendance-course-select');
      const sumSelect = document.getElementById('summary-filter-course');

      if (select) {
        if (enrolledCoursesList.length === 0) {
          select.innerHTML = '<option value="">-- No Courses Assigned --</option>';
        } else {
          select.innerHTML = '<option value="">-- Select Course --</option>' +
            enrolledCoursesList.map(c => `<option value="${c._id}">${c.code} - ${c.name} (Sem ${c.semester})</option>`).join('');
        }
      }

      if (sumSelect) {
        sumSelect.innerHTML = '<option value="">All Courses</option>' +
          enrolledCoursesList.map(c => `<option value="${c._id}">${c.code} - ${c.name}</option>`).join('');
      }

      // If courses exist, trigger load for first course
      if (enrolledCoursesList.length > 0 && select) {
        // If courseId in URL query, select it
        const urlParams = new URLSearchParams(window.location.search);
        const queryCourseId = urlParams.get('courseId');
        if (queryCourseId) {
          select.value = queryCourseId;
        } else {
          select.selectedIndex = 1;
        }
        onCourseOrDateChange();
      }
    }
  } catch (error) {
    window.smsAuth.showToast('Failed to load courses: ' + error.message, 'danger');
  }
};

const onCourseOrDateChange = async () => {
  const courseId = document.getElementById('attendance-course-select')?.value;
  const date = document.getElementById('attendance-date')?.value;
  const rosterBody = document.getElementById('attendance-roster-body');
  const alertBanner = document.getElementById('attendance-mode-banner');
  const submitBtn = document.getElementById('save-attendance-btn');

  if (!courseId || !date) {
    if (rosterBody) rosterBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">Please select a course to begin attendance.</td></tr>';
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  rosterBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading student roster...</td></tr>';
  if (submitBtn) submitBtn.disabled = true;

  try {
    // 1. Fetch students enrolled in this course
    const studentRes = await window.smsAuth.apiRequest(`/api/courses/${courseId}/students`);
    if (!studentRes.success) throw new Error(studentRes.message);

    currentStudentsList = studentRes.students;

    if (currentStudentsList.length === 0) {
      rosterBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No students enrolled in this course semester.</td></tr>';
      alertBanner.style.display = 'none';
      return;
    }

    // 2. Check if attendance already recorded for this date
    const checkRes = await window.smsAuth.apiRequest(`/api/attendance/check?courseId=${courseId}&date=${date}`);
    const existingMap = checkRes.records || {};

    if (checkRes.hasRecords) {
      alertBanner.style.display = 'block';
      alertBanner.className = 'card';
      alertBanner.style.backgroundColor = '#eff6ff';
      alertBanner.style.borderColor = '#bfdbfe';
      alertBanner.style.marginBottom = '1.25rem';
      alertBanner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem; color: #1e40af; font-size: 0.9rem;">
          <span style="font-size: 1.25rem;">ℹ️</span>
          <span>Attendance has already been recorded for <strong>${date}</strong> (${checkRes.count} students). Resubmission will update the records.</span>
        </div>
      `;
    } else {
      alertBanner.style.display = 'none';
    }

    // Render roster
    rosterBody.innerHTML = currentStudentsList.map((s, index) => {
      const sId = String(s._id);
      const isExisting = existingMap[sId];
      // If already recorded, use existing status; otherwise default to Present
      const status = isExisting ? isExisting.status : 'Present';
      const remarks = isExisting ? isExisting.remarks : '';

      return `
        <tr>
          <td>
            <strong style="color: var(--primary); font-family: 'JetBrains Mono', monospace;">${s.rollNumber}</strong>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-main);">${s.name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">Sem ${s.semester} (Sec ${s.section || 'A'})</div>
          </td>
          <td>
            <div class="attendance-segment-wrap">
              <label class="attendance-segment-label">
                <input type="radio" name="status_${sId}" value="Present" ${status === 'Present' ? 'checked' : ''} onchange="updateAttendanceStats()">
                <span>✓ Present</span>
              </label>
              <label class="attendance-segment-label">
                <input type="radio" name="status_${sId}" value="Absent" ${status === 'Absent' ? 'checked' : ''} onchange="updateAttendanceStats()">
                <span>✗ Absent</span>
              </label>
            </div>
          </td>
          <td>
            <input type="text" id="remarks_${sId}" class="form-control" style="font-size: 0.88rem; padding: 0.5rem 0.85rem;" placeholder="Optional remarks..." value="${remarks}">
          </td>
        </tr>
      `;
    }).join('');

    submitBtn.disabled = false;
    updateAttendanceStats();
  } catch (error) {
    rosterBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 2rem;">${error.message}</td></tr>`;
    if (submitBtn) submitBtn.disabled = true;
  }
};

const updateAttendanceStats = () => {
  const ticker = document.getElementById('attendance-ticker');
  if (!ticker || currentStudentsList.length === 0) return;

  ticker.style.display = 'flex';
  const total = currentStudentsList.length;
  let present = 0;
  let absent = 0;

  currentStudentsList.forEach(s => {
    const sId = String(s._id);
    const radio = document.querySelector(`input[name="status_${sId}"]:checked`);
    if (radio) {
      if (radio.value === 'Present') present++;
      else if (radio.value === 'Absent') absent++;
    }
  });

  const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;

  const totalEl = document.getElementById('ticker-total');
  const presEl = document.getElementById('ticker-present');
  const absEl = document.getElementById('ticker-absent');
  const rateEl = document.getElementById('ticker-rate');

  if (totalEl) totalEl.textContent = total;
  if (presEl) presEl.textContent = present;
  if (absEl) absEl.textContent = absent;
  if (rateEl) rateEl.textContent = rate + '%';
};

const markAllStatus = (targetStatus) => {
  currentStudentsList.forEach(s => {
    const sId = String(s._id);
    const radio = document.querySelector(`input[name="status_${sId}"][value="${targetStatus}"]`);
    if (radio) {
      radio.checked = true;
    }
  });
  updateAttendanceStats();
  window.smsAuth.showToast(`All students marked ${targetStatus}.`, 'info');
};

const handleAttendanceSubmit = async (e) => {
  e.preventDefault();
  const courseId = document.getElementById('attendance-course-select').value;
  const date = document.getElementById('attendance-date').value;
  const submitBtn = document.getElementById('save-attendance-btn');

  if (!courseId || !date) {
    window.smsAuth.showToast('Please select course and date.', 'warning');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving Attendance...';

  const records = currentStudentsList.map(s => {
    const sId = String(s._id);
    const selectedRadio = document.querySelector(`input[name="status_${sId}"]:checked`);
    const status = selectedRadio ? selectedRadio.value : 'Present';
    const remarks = document.getElementById(`remarks_${sId}`)?.value || '';

    return {
      studentId: sId,
      status,
      remarks
    };
  });

  try {
    const res = await window.smsAuth.apiRequest('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        courseId,
        date,
        records
      })
    });

    window.smsAuth.showToast(res.message, 'success');
    // Refresh banner and status
    onCourseOrDateChange();
  } catch (error) {
    window.smsAuth.showToast(error.message, 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Attendance';
  }
};

/**
 * Load Attendance Summary and Percentage calculations
 */
const loadAttendanceSummary = async () => {
  const container = document.getElementById('summary-table-body');
  const courseId = document.getElementById('summary-filter-course')?.value || '';

  if (!container) return;
  container.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">Calculating attendance percentages...</td></tr>';

  try {
    const query = new URLSearchParams();
    if (courseId) query.append('courseId', courseId);

    const res = await window.smsAuth.apiRequest(`/api/attendance/summary?${query.toString()}`);
    if (!res.success) throw new Error(res.message);

    const list = Array.isArray(res.summary) ? res.summary : [res.summary];

    if (list.length === 0 || !list[0]) {
      container.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No attendance records found.</td></tr>';
      return;
    }

    container.innerHTML = list.map(item => {
      const isLow = item.isLowAttendance;
      const attClass = item.overallPercentage >= 75 ? 'green' : (item.overallPercentage >= 50 ? 'amber' : 'red');

      return `
        <tr class="${isLow ? 'attendance-warning-row' : ''}">
          <td>
            <strong style="color: var(--primary);">${item.rollNumber}</strong>
          </td>
          <td>
            <div style="font-weight: 600;">${item.name}</div>
          </td>
          <td>
            <strong>${item.totalAttended}</strong> / ${item.totalClasses} classes
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="font-weight: 700; min-width: 50px;">${item.overallPercentage}%</div>
              <div class="progress-container" style="flex: 1; max-width: 140px; margin-top: 0;">
                <div class="progress-bar ${attClass}" style="width: ${item.overallPercentage}%;"></div>
              </div>
            </div>
          </td>
          <td>
            ${isLow ? `
              <span class="attendance-alert-chip">
                ⚠️ Low (${item.overallPercentage}%)
              </span>
            ` : `
              <span class="badge badge-success">Good (>= 75%)</span>
            `}
          </td>
          <td>
            <a href="reports.html?studentId=${item.studentId}" class="btn btn-secondary btn-sm">
              View Report
            </a>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 2rem;">${error.message}</td></tr>`;
  }
};

/**
 * Student Personal Attendance View (Student Role)
 */
const loadStudentPersonalAttendance = async () => {
  const container = document.getElementById('student-personal-attendance-container');
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-muted);">Loading your attendance records...</div>';

  try {
    const res = await window.smsAuth.apiRequest('/api/attendance/summary');
    if (!res.success) throw new Error(res.message);

    const data = res.summary;
    if (!data) {
      container.innerHTML = '<div class="card"><p>No attendance recorded for your profile yet.</p></div>';
      return;
    }

    const overallPct = data.overallPercentage;
    const isLow = data.isLowAttendance;
    const attClass = overallPct >= 75 ? 'green' : (overallPct >= 50 ? 'amber' : 'red');

    container.innerHTML = `
      <!-- Overall Card -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <div>
            <div class="card-title">📅 Academic Attendance Record</div>
            <div class="card-subtitle">Institute Minimum Threshold Requirement: 75%</div>
          </div>
          ${isLow ? '<span class="attendance-alert-chip" style="font-size: 0.9rem;">⚠️ Low Attendance Alert (<75%)</span>' : '<span class="badge badge-success" style="font-size: 0.85rem;">Good Attendance Standing</span>'}
        </div>

        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 2rem;">
          <div>
            <div style="font-size: 3rem; font-weight: 800; color: ${isLow ? 'var(--danger)' : 'var(--text-main)'};">${overallPct}%</div>
            <div style="color: var(--text-muted); font-size: 0.85rem;">Overall Attendance Rate</div>
          </div>
          <div style="flex: 1; min-width: 200px;">
            <div style="font-size: 0.9rem; font-weight: 600; margin-bottom: 0.4rem;">
              Classes Attended: ${data.totalAttended} of ${data.totalClasses} total conducted
            </div>
            <div class="progress-container" style="height: 12px;">
              <div class="progress-bar ${attClass}" style="width: ${overallPct}%;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Subject-wise Breakdown Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📚 Course-wise Breakdown</div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Classes Attended</th>
                <th>Total Classes</th>
                <th>Attendance %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.courseBreakdown.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No courses with attendance yet.</td></tr>' :
                data.courseBreakdown.map(c => `
                  <tr class="${c.isLowAttendance ? 'attendance-warning-row' : ''}">
                    <td><strong>${c.courseName} (${c.courseCode})</strong></td>
                    <td>${c.attended}</td>
                    <td>${c.totalClasses}</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <strong>${c.percentage}%</strong>
                        <div class="progress-container" style="width: 80px; margin-top: 0;">
                          <div class="progress-bar ${c.percentage >= 75 ? 'green' : (c.percentage >= 50 ? 'amber' : 'red')}" style="width: ${c.percentage}%;"></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      ${c.isLowAttendance ? `
                        <span class="attendance-alert-chip">Below 75%</span>
                      ` : `
                        <span class="badge badge-success">Sufficient</span>
                      `}
                    </td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="card" style="color: var(--danger);">${error.message}</div>`;
  }
};

const updateRowHighlight = (radioEl) => {
  const row = radioEl.closest('tr');
  if (!row) return;
  if (radioEl.value === 'Absent') {
    row.style.backgroundColor = '#fff5f5';
  } else {
    row.style.backgroundColor = '';
  }
};

window.updateRowHighlight = updateRowHighlight;


