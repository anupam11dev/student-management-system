/**
 * Student Management Module Logic
 */

let currentPage = 1;
const limit = 10;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
  // Only Admin and Teacher can access this page
  if (!window.smsAuth.requireAuth(['admin', 'teacher'])) return;

  const user = window.smsAuth.getUser();
  if (user.role !== 'admin') {
    // Hide Add Student button if not admin
    const addBtn = document.getElementById('btn-add-student');
    if (addBtn) addBtn.style.display = 'none';
  }

  setupEventListeners();
  loadStudents();
});

const setupEventListeners = () => {
  // Search input debouncing
  let searchTimeout;
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadStudents();
      }, 300);
    });
  }

  // Course & Semester filters
  document.getElementById('filter-course')?.addEventListener('change', () => {
    currentPage = 1;
    loadStudents();
  });

  document.getElementById('filter-semester')?.addEventListener('change', () => {
    currentPage = 1;
    loadStudents();
  });

  // Modal toggle handlers
  document.getElementById('btn-add-student')?.addEventListener('click', openAddModal);
  document.getElementById('close-modal-btn')?.addEventListener('click', closeModal);
  document.getElementById('cancel-modal-btn')?.addEventListener('click', closeModal);
  document.getElementById('student-form')?.addEventListener('submit', handleFormSubmit);
  document.getElementById('quick-att-form')?.addEventListener('submit', handleQuickAttSubmit);
  document.getElementById('quick-marks-form')?.addEventListener('submit', handleQuickMarksSubmit);

  // Pagination buttons
  document.getElementById('prev-page-btn')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadStudents();
    }
  });

  document.getElementById('next-page-btn')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadStudents();
    }
  });
};

const loadStudents = async () => {
  const tableBody = document.getElementById('students-table-body');
  const search = document.getElementById('search-input')?.value || '';
  const course = document.getElementById('filter-course')?.value || '';
  const semester = document.getElementById('filter-semester')?.value || '';

  tableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
        Loading students...
      </td>
    </tr>
  `;

  try {
    const queryParams = new URLSearchParams({
      page: currentPage,
      limit,
      search,
      course,
      semester
    });

    const res = await window.smsAuth.apiRequest(`/api/students?${queryParams.toString()}`);
    if (!res.success) throw new Error(res.message);

    totalPages = res.pagination.totalPages;
    renderStudentsTable(res.students, res.pagination);
  } catch (error) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">
          Failed to load students: ${error.message}
        </td>
      </tr>
    `;
  }
};

const renderStudentsTable = (students, pagination) => {
  const tableBody = document.getElementById('students-table-body');
  const user = window.smsAuth.getUser();
  const isAdmin = user.role === 'admin';

  // Update pagination info
  const infoEl = document.getElementById('pagination-info');
  if (infoEl) {
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.total, pagination.page * pagination.limit);
    infoEl.textContent = pagination.total > 0
      ? `Showing ${start} to ${end} of ${pagination.total} students`
      : 'No students found';
  }

  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  if (prevBtn) prevBtn.disabled = pagination.page <= 1;
  if (nextBtn) nextBtn.disabled = pagination.page >= pagination.totalPages;

  if (students.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          No student records found matching the current criteria.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = students.map(s => {
    const initials = s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return `
    <tr>
      <td>
        <strong style="color: var(--primary); font-family: 'JetBrains Mono', monospace; font-size: 0.95rem;">${s.rollNumber}</strong>
      </td>
      <td>
        <div class="student-avatar-cell">
          <div class="student-avatar-sm">${initials}</div>
          <div>
            <div style="font-weight: 700; color: var(--text-main);">${s.name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">DOB: ${s.dob || 'N/A'}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="badge badge-info">${s.courseName}</span>
        <div style="font-size: 0.8rem; margin-top: 0.3rem; color: var(--text-muted); font-weight: 600;">Semester ${s.semester} • Sec ${s.section || 'A'}</div>
      </td>
      <td>
        <div style="font-size: 0.88rem; font-weight: 500;">${s.email}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${s.phone}</div>
      </td>
      <td>
        <span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-neutral'}">
          ${s.status}
        </span>
      </td>
      <td>
        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
          <button class="btn btn-secondary btn-sm" onclick="openQuickAttendanceModal('${s._id}', '${s.name.replace(/'/g, "\\'")}', '${s.rollNumber}', ${s.semester})" title="Mark Attendance for this student">
            📅 Attendance
          </button>
          <button class="btn btn-secondary btn-sm" onclick="openQuickMarksModal('${s._id}', '${s.name.replace(/'/g, "\\'")}', '${s.rollNumber}', ${s.semester})" title="Enter Exam Marks for this student">
            📝 Marks
          </button>
          <a href="reports.html?studentId=${s._id}" class="btn btn-secondary btn-sm" title="View Full Academic Transcript">
            📑 Report
          </a>
          ${isAdmin ? `
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${s._id}')" title="Edit Student Profile">
              ✏️
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="confirmDelete('${s._id}', '${s.name.replace(/'/g, "\\'")}', '${s.rollNumber}')" title="Delete Student Record">
              🗑️
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `;
  }).join('');
};

/* Modal Handling */
let editingStudentId = null;

const openAddModal = () => {
  editingStudentId = null;
  document.getElementById('modal-title').textContent = 'Add New Student';
  document.getElementById('student-form').reset();
  document.getElementById('student-id-field').value = '';
  document.getElementById('account-creation-section').style.display = 'block';
  document.getElementById('modal-overlay').classList.add('active');
};

const openEditModal = async (studentId) => {
  editingStudentId = studentId;
  document.getElementById('modal-title').textContent = 'Edit Student Details';
  document.getElementById('account-creation-section').style.display = 'none';

  try {
    const res = await window.smsAuth.apiRequest(`/api/students/${studentId}`);
    if (!res.success) throw new Error(res.message);

    const s = res.student;
    document.getElementById('student-id-field').value = s._id;
    document.getElementById('student-name').value = s.name;
    document.getElementById('student-roll').value = s.rollNumber;
    document.getElementById('student-email').value = s.email;
    document.getElementById('student-phone').value = s.phone;
    document.getElementById('student-dob').value = s.dob;
    document.getElementById('student-course').value = s.courseName;
    document.getElementById('student-semester').value = s.semester;
    document.getElementById('student-section').value = s.section || 'A';
    document.getElementById('student-address').value = s.address || '';

    document.getElementById('modal-overlay').classList.add('active');
  } catch (error) {
    window.smsAuth.showToast(error.message, 'danger');
  }
};

const closeModal = () => {
  document.getElementById('modal-overlay').classList.remove('active');
  editingStudentId = null;
};

const handleFormSubmit = async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('save-student-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const payload = {
    name: document.getElementById('student-name').value.trim(),
    rollNumber: document.getElementById('student-roll').value.trim(),
    email: document.getElementById('student-email').value.trim(),
    phone: document.getElementById('student-phone').value.trim(),
    dob: document.getElementById('student-dob').value,
    courseName: document.getElementById('student-course').value,
    semester: parseInt(document.getElementById('student-semester').value),
    section: document.getElementById('student-section').value.trim(),
    address: document.getElementById('student-address').value.trim(),
    createAccount: document.getElementById('create-account-checkbox')?.checked || false,
    password: document.getElementById('account-password')?.value || undefined
  };

  try {
    if (editingStudentId) {
      // Update
      const res = await window.smsAuth.apiRequest(`/api/students/${editingStudentId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      window.smsAuth.showToast(`Student ${res.student.name} updated successfully.`, 'success');
    } else {
      // Create
      const res = await window.smsAuth.apiRequest('/api/students', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      window.smsAuth.showToast(`Student ${res.student.name} created successfully.`, 'success');
      if (res.accountCreated) {
        window.smsAuth.showToast(`Login account linked (${res.defaultCredentials.email} / ${res.defaultCredentials.password})`, 'info');
      }
    }

    closeModal();
    loadStudents();
  } catch (error) {
    window.smsAuth.showToast(error.message, 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Student';
  }
};

const confirmDelete = async (id, name, rollNumber) => {
  const confirmMsg = `Are you sure you want to permanently delete student "${name}" (${rollNumber})?\n\nCAUTION: All attendance and examination marks for this student will also be removed.`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await window.smsAuth.apiRequest(`/api/students/${id}`, {
      method: 'DELETE'
    });
    window.smsAuth.showToast(res.message, 'success');
    loadStudents();
  } catch (error) {
    window.smsAuth.showToast(error.message, 'danger');
  }
};

/* Quick Attendance Modal */
const openQuickAttendanceModal = async (studentId, name, rollNumber, semester) => {
  document.getElementById('quick-att-student-id').value = studentId;
  document.getElementById('quick-att-student-name').textContent = name;
  document.getElementById('quick-att-student-roll').textContent = rollNumber;
  document.getElementById('quick-att-remarks').value = '';
  
  const today = new Date().toISOString().substring(0, 10);
  const dateInput = document.getElementById('quick-att-date');
  dateInput.value = today;
  dateInput.max = today;
  
  const select = document.getElementById('quick-att-course');
  select.innerHTML = '<option value="">Loading courses...</option>';
  document.getElementById('quick-attendance-modal').classList.add('active');

  try {
    const user = window.smsAuth.getUser();
    const mineParam = user && user.role === 'teacher' ? '&mine=true' : '';
    const res = await window.smsAuth.apiRequest(`/api/courses?semester=${semester}${mineParam}`);
    if (res.success && res.courses.length > 0) {
      select.innerHTML = res.courses.map(c => `<option value="${c._id}">${c.code} - ${c.name}</option>`).join('');
    } else {
      select.innerHTML = '<option value="">No courses assigned for Semester ' + semester + '</option>';
    }
  } catch (err) {
    select.innerHTML = '<option value="">Error loading courses</option>';
  }
};

const closeQuickAttModal = () => {
  document.getElementById('quick-attendance-modal').classList.remove('active');
};

const handleQuickAttSubmit = async (e) => {
  e.preventDefault();
  const studentId = document.getElementById('quick-att-student-id').value;
  const courseId = document.getElementById('quick-att-course').value;
  const date = document.getElementById('quick-att-date').value;
  const status = document.querySelector('input[name="quick_att_status"]:checked')?.value || 'Present';
  const remarks = document.getElementById('quick-att-remarks').value.trim();
  const btn = document.getElementById('quick-att-submit-btn');

  if (!courseId) {
    window.smsAuth.showToast('Please select a course.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await window.smsAuth.apiRequest('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        courseId,
        date,
        records: [{ studentId, status, remarks }]
      })
    });
    window.smsAuth.showToast(res.message, 'success');
    closeQuickAttModal();
  } catch (err) {
    window.smsAuth.showToast(err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Attendance';
  }
};

/* Quick Marks Modal */
const openQuickMarksModal = async (studentId, name, rollNumber, semester) => {
  document.getElementById('quick-marks-student-id').value = studentId;
  document.getElementById('quick-marks-student-name').textContent = name;
  document.getElementById('quick-marks-student-roll').textContent = rollNumber;
  document.getElementById('quick-marks-obtained').value = '';
  document.getElementById('quick-marks-remarks').value = '';
  document.getElementById('quick-marks-exam-type').value = 'Assignment';
  document.getElementById('quick-marks-max').value = '20';
  calculateQuickMarksPct();

  const select = document.getElementById('quick-marks-course');
  select.innerHTML = '<option value="">Loading courses...</option>';
  document.getElementById('quick-marks-modal').classList.add('active');

  try {
    const user = window.smsAuth.getUser();
    const mineParam = user && user.role === 'teacher' ? '&mine=true' : '';
    const res = await window.smsAuth.apiRequest(`/api/courses?semester=${semester}${mineParam}`);
    if (res.success && res.courses.length > 0) {
      select.innerHTML = res.courses.map(c => `<option value="${c._id}">${c.code} - ${c.name}</option>`).join('');
    } else {
      select.innerHTML = '<option value="">No courses assigned for Semester ' + semester + '</option>';
    }
  } catch (err) {
    select.innerHTML = '<option value="">Error loading courses</option>';
  }
};

const closeQuickMarksModal = () => {
  document.getElementById('quick-marks-modal').classList.remove('active');
};

const onQuickMarksExamChange = () => {
  const exam = document.getElementById('quick-marks-exam-type').value;
  const maxInput = document.getElementById('quick-marks-max');
  if (exam === 'Assignment') maxInput.value = 20;
  else if (exam === 'Internal') maxInput.value = 30;
  else if (exam === 'Semester') maxInput.value = 100;
  calculateQuickMarksPct();
};

const calculateQuickMarksPct = () => {
  const obtained = parseFloat(document.getElementById('quick-marks-obtained')?.value);
  const max = parseFloat(document.getElementById('quick-marks-max')?.value);
  const text = document.getElementById('quick-marks-pct-text');
  const badge = document.getElementById('quick-marks-badge');

  if (isNaN(obtained) || isNaN(max) || max <= 0) {
    if (text) text.textContent = '--%';
    if (badge) badge.innerHTML = '<span class="badge badge-neutral">--</span>';
    return;
  }

  if (obtained < 0 || obtained > max) {
    if (text) text.textContent = 'Invalid!';
    if (badge) badge.innerHTML = '<span class="badge badge-danger">Out of range</span>';
    return;
  }

  const pct = Math.round((obtained / max) * 1000) / 10;
  if (text) text.textContent = `${pct}% (${obtained} / ${max})`;
  if (badge) {
    badge.innerHTML = pct >= 40
      ? '<span class="badge badge-success">PASS</span>'
      : '<span class="badge badge-danger">FAIL</span>';
  }
};

const handleQuickMarksSubmit = async (e) => {
  e.preventDefault();
  const studentId = document.getElementById('quick-marks-student-id').value;
  const courseId = document.getElementById('quick-marks-course').value;
  const examType = document.getElementById('quick-marks-exam-type').value;
  const obtainedMarks = parseFloat(document.getElementById('quick-marks-obtained').value);
  const maxMarks = parseFloat(document.getElementById('quick-marks-max').value);
  const remarks = document.getElementById('quick-marks-remarks').value.trim();
  const btn = document.getElementById('quick-marks-submit-btn');

  if (!courseId) {
    window.smsAuth.showToast('Please select a course.', 'warning');
    return;
  }

  if (isNaN(obtainedMarks) || isNaN(maxMarks) || obtainedMarks < 0 || obtainedMarks > maxMarks) {
    window.smsAuth.showToast('Please enter valid obtained marks (0 to max marks).', 'danger');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await window.smsAuth.apiRequest('/api/marks', {
      method: 'POST',
      body: JSON.stringify({
        courseId,
        examType,
        entries: [{ studentId, obtainedMarks, maxMarks, remarks }]
      })
    });
    window.smsAuth.showToast(res.message, 'success');
    closeQuickMarksModal();
  } catch (err) {
    window.smsAuth.showToast(err.message, 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Marks';
  }
};

// Expose modal functions to window for onclick handlers
window.openEditModal = openEditModal;
window.confirmDelete = confirmDelete;
window.openQuickAttendanceModal = openQuickAttendanceModal;
window.closeQuickAttModal = closeQuickAttModal;
window.openQuickMarksModal = openQuickMarksModal;
window.closeQuickMarksModal = closeQuickMarksModal;
window.onQuickMarksExamChange = onQuickMarksExamChange;
window.calculateQuickMarksPct = calculateQuickMarksPct;


