/**
 * Course Management Logic
 */

let teachersList = [];
let editingCourseId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.smsAuth.requireAuth()) return;

  const user = window.smsAuth.getUser();
  if (user.role === 'admin') {
    loadTeachersList();
  }

  setupEventListeners();
  loadCourses();
});

const setupEventListeners = () => {
  document.getElementById('search-course')?.addEventListener('input', loadCourses);
  document.getElementById('filter-course-semester')?.addEventListener('change', loadCourses);

  document.getElementById('btn-add-course')?.addEventListener('click', openAddModal);
  document.getElementById('close-course-modal')?.addEventListener('click', closeCourseModal);
  document.getElementById('cancel-course-modal')?.addEventListener('click', closeCourseModal);
  document.getElementById('course-form')?.addEventListener('submit', handleFormSubmit);

  document.getElementById('close-enrolled-modal')?.addEventListener('click', () => {
    document.getElementById('enrolled-modal-overlay').classList.remove('active');
  });
};

const loadTeachersList = async () => {
  try {
    const res = await window.smsAuth.apiRequest('/api/auth/teachers');
    if (res.success) {
      teachersList = res.teachers;
      const selectEl = document.getElementById('course-teacher');
      if (selectEl) {
        selectEl.innerHTML = '<option value="">-- Unassigned (Assign Later) --</option>' +
          teachersList.map(t => `<option value="${t.id}">${t.name} (${t.department})</option>`).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load teachers list:', err);
  }
};

const loadCourses = async () => {
  const container = document.getElementById('courses-container');
  const search = document.getElementById('search-course')?.value || '';
  const semester = document.getElementById('filter-course-semester')?.value || '';
  const user = window.smsAuth.getUser();

  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
      Loading courses...
    </div>
  `;

  try {
    const query = new URLSearchParams({ search, semester });
    const res = await window.smsAuth.apiRequest(`/api/courses?${query.toString()}`);
    if (!res.success) throw new Error(res.message);

    renderCourses(res.courses, container);
  } catch (error) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--danger); padding: 2rem;">
        Failed to load courses: ${error.message}
      </div>
    `;
  }
};

const renderCourses = (courses, container) => {
  const user = window.smsAuth.getUser();
  const isAdmin = user.role === 'admin';
  const isTeacher = user.role === 'teacher';

  if (courses.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
        No courses found matching criteria.
      </div>
    `;
    return;
  }

  container.innerHTML = courses.map(c => {
    const teacherId = c.teacherId ? String(c.teacherId._id || c.teacherId) : null;
    const isMyCourse = isTeacher && teacherId === String(user.id || user._id);
    const teacherName = c.teacherId ? c.teacherId.name : 'Unassigned';

    return `
      <div class="card" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between; ${isMyCourse ? 'border: 2px solid #3b82f6; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);' : ''}">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <span class="badge badge-info" style="font-size: 0.85rem; font-weight: 800;">${c.code}</span>
              ${isMyCourse ? '<span class="badge badge-success" style="font-size: 0.75rem;">★ Your Course</span>' : ''}
            </div>
            <span class="badge badge-neutral">Semester ${c.semester}</span>
          </div>

          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.4rem;">
            ${c.name}
          </h3>

          <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 1rem; min-height: 2.8rem;">
            ${c.description || 'Comprehensive curriculum covering theoretical foundations and hands-on laboratory exercises.'}
          </p>

          <div style="background-color: var(--bg-subtle); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.82rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
              <span style="color: var(--text-muted);">Instructor:</span>
              <strong style="${isMyCourse ? 'color: var(--primary); font-weight: 700;' : 'color: var(--text-main);'}">
                ${teacherName} ${isMyCourse ? '(You)' : ''}
              </strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
              <span style="color: var(--text-muted);">Credits:</span>
              <strong>${c.credits || 4} Credits</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Enrolled Students:</span>
              <strong style="color: var(--primary);">${c.studentCount} Students</strong>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
          <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="viewEnrolled('${c._id}')">
            👥 Enrolled (${c.studentCount})
          </button>
          ${isMyCourse || isAdmin ? `
            <a href="attendance.html?courseId=${c._id}" class="btn btn-secondary btn-sm" title="Mark Attendance">
              📅 Attendance
            </a>
            <a href="marks.html?courseId=${c._id}" class="btn btn-secondary btn-sm" title="Enter Marks">
              📝 Marks
            </a>
          ` : ''}
          ${isAdmin ? `
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${c._id}')" title="Edit Course">
              ✏️
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="confirmDelete('${c._id}', '${c.name}', '${c.code}')" title="Delete Course">
              🗑️
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
};

/* Modal Handling */
const openAddModal = () => {
  editingCourseId = null;
  const user = window.smsAuth.getUser();
  document.getElementById('course-modal-title').textContent = user.role === 'teacher' ? 'Add Course (Taught by You)' : 'Create New Course';
  document.getElementById('course-form').reset();
  document.getElementById('course-id-field').value = '';

  const teacherGroup = document.getElementById('course-teacher')?.closest('.form-group');
  if (teacherGroup) {
    teacherGroup.style.display = user.role === 'teacher' ? 'none' : 'block';
  }
  document.getElementById('course-modal-overlay').classList.add('active');
};

const openEditModal = async (courseId) => {
  editingCourseId = courseId;
  document.getElementById('course-modal-title').textContent = 'Edit Course';

  try {
    const res = await window.smsAuth.apiRequest(`/api/courses/${courseId}`);
    if (!res.success) throw new Error(res.message);

    const c = res.course;
    document.getElementById('course-id-field').value = c._id;
    document.getElementById('course-name').value = c.name;
    document.getElementById('course-code').value = c.code;
    document.getElementById('course-semester').value = c.semester;
    document.getElementById('course-department').value = c.department || 'CSE';
    document.getElementById('course-credits').value = c.credits || 4;
    document.getElementById('course-description').value = c.description || '';

    const teacherVal = c.teacherId ? (c.teacherId._id || c.teacherId) : '';
    document.getElementById('course-teacher').value = teacherVal;

    document.getElementById('course-modal-overlay').classList.add('active');
  } catch (error) {
    window.smsAuth.showToast(error.message, 'danger');
  }
};

const closeCourseModal = () => {
  document.getElementById('course-modal-overlay').classList.remove('active');
  editingCourseId = null;
};

const handleFormSubmit = async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('save-course-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const payload = {
    name: document.getElementById('course-name').value.trim(),
    code: document.getElementById('course-code').value.trim(),
    semester: parseInt(document.getElementById('course-semester').value),
    department: document.getElementById('course-department').value.trim(),
    credits: parseInt(document.getElementById('course-credits').value),
    teacherId: document.getElementById('course-teacher').value || null,
    description: document.getElementById('course-description').value.trim()
  };

  try {
    if (editingCourseId) {
      const res = await window.smsAuth.apiRequest(`/api/courses/${editingCourseId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      window.smsAuth.showToast(`Course ${res.course.code} updated successfully.`, 'success');
    } else {
      const res = await window.smsAuth.apiRequest('/api/courses', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      window.smsAuth.showToast(`Course ${res.course.code} created successfully.`, 'success');
    }

    closeCourseModal();
    loadCourses();
  } catch (error) {
    window.smsAuth.showToast(error.message, 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Course';
  }
};

const confirmDelete = async (id, name, code) => {
  const msg = `Are you sure you want to delete course "${name}" (${code})?\n\nAll attendance records and examination marks tied to this course will also be removed.`;
  if (!confirm(msg)) return;

  try {
    const res = await window.smsAuth.apiRequest(`/api/courses/${id}`, { method: 'DELETE' });
    window.smsAuth.showToast(res.message, 'success');
    loadCourses();
  } catch (error) {
    window.smsAuth.showToast(error.message, 'danger');
  }
};

const viewEnrolled = async (courseId) => {
  const modal = document.getElementById('enrolled-modal-overlay');
  const title = document.getElementById('enrolled-modal-title');
  const list = document.getElementById('enrolled-students-list');

  title.textContent = 'Enrolled Students';
  list.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading enrolled students...</div>';
  modal.classList.add('active');

  try {
    const res = await window.smsAuth.apiRequest(`/api/courses/${courseId}/students`);
    if (!res.success) throw new Error(res.message);

    title.textContent = `${res.course.name} (${res.course.code}) - Enrolled (${res.students.length})`;

    if (res.students.length === 0) {
      list.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No students enrolled in Semester ${res.course.semester} currently.</div>`;
      return;
    }

    list.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Roll No</th>
            <th>Name</th>
            <th>Program</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          ${res.students.map(s => `
            <tr>
              <td><strong>${s.rollNumber}</strong></td>
              <td>${s.name}</td>
              <td>${s.courseName} (Sem ${s.semester})</td>
              <td>${s.email}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    list.innerHTML = `<div style="color: var(--danger); padding: 1.5rem;">${error.message}</div>`;
  }
};

window.openEditModal = openEditModal;
window.confirmDelete = confirmDelete;
window.viewEnrolled = viewEnrolled;

