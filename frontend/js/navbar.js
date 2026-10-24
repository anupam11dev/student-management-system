/**
 * Shared Dynamic Navigation and Header Renderer
 */

document.addEventListener('DOMContentLoaded', () => {
  const user = window.smsAuth.getUser();
  if (!user) return; // If on login page, skip

  renderSidebar(user);
  renderHeader(user);
  attachMobileToggle();
});

const renderSidebar = (user) => {
  const sidebarEl = document.getElementById('app-sidebar');
  if (!sidebarEl) return;

  const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
  const role = user.role;

  // Navigation items by role
  let navItems = [];

  if (role === 'admin') {
    navItems = [
      { name: 'Institute Dashboard', url: 'dashboard.html', icon: '📊' },
      { name: 'Student Directory', url: 'students.html', icon: '🎓' },
      { name: 'Course Management', url: 'courses.html', icon: '📚' },
      { name: 'Attendance Oversight', url: 'attendance.html', icon: '📅' },
      { name: 'Marks & Results', url: 'marks.html', icon: '📝' },
      { name: 'Academic Reports', url: 'reports.html', icon: '📑' }
    ];
  } else if (role === 'teacher') {
    navItems = [
      { name: 'Faculty Dashboard', url: 'dashboard.html', icon: '📊' },
      { name: 'My Assigned Courses', url: 'courses.html', icon: '📚' },
      { name: 'My Class Students', url: 'students.html', icon: '🎓' },
      { name: 'Mark Attendance', url: 'attendance.html', icon: '📅' },
      { name: 'Enter Exam Marks', url: 'marks.html', icon: '📝' },
      { name: 'Student Transcripts', url: 'reports.html', icon: '📑' }
    ];
  } else if (role === 'student') {
    navItems = [
      { name: 'My Dashboard', url: 'dashboard.html', icon: '📊' },
      { name: 'My Attendance', url: 'attendance.html', icon: '📅' },
      { name: 'My Results', url: 'marks.html', icon: '📝' },
      { name: 'My Report Card', url: 'reports.html', icon: '📑' }
    ];
  }

  const roleTitleMap = {
    admin: 'Administrator Portal',
    teacher: 'Faculty / Teacher Portal',
    student: 'Student Academic Portal'
  };

  const navLinksHtml = navItems.map(item => {
    const isActive = currentPath === item.url ? 'active' : '';
    return `
      <a href="${item.url}" class="nav-link ${isActive}">
        <span style="font-size: 1.15rem;">${item.icon}</span>
        <span>${item.name}</span>
      </a>
    `;
  }).join('');

  const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  sidebarEl.innerHTML = `
    <div class="sidebar-header">
      <div class="brand-icon">🎓</div>
      <div>
        <div class="brand-title">SMS Portal</div>
        <div class="brand-subtitle">${roleTitleMap[role] || 'Academic Suite'}</div>
      </div>
    </div>

    <div class="sidebar-nav">
      <div class="nav-section-title">Navigation</div>
      ${navLinksHtml}
    </div>

    <div class="sidebar-user">
      <div class="user-avatar">${initials}</div>
      <div class="user-info">
        <div class="user-name" title="${user.name}">${user.name}</div>
        <div class="user-role-badge">${user.role}</div>
      </div>
      <button class="btn-logout" id="logout-btn" title="Log Out">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>

    <div style="padding: 0.55rem 1.25rem; font-size: 0.72rem; color: #64748b; display: flex; align-items: center; gap: 0.5rem; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.35);">
      <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block; box-shadow: 0 0 6px #10b981;"></span>
      <span style="letter-spacing: 0.02em;">SMS Core: Connected</span>
    </div>
  `;

  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to log out?')) {
      window.smsAuth.logout();
    }
  });
};

const renderHeader = (user) => {
  const headerDateEl = document.getElementById('header-live-date');
  if (headerDateEl) {
    const today = new Date();
    headerDateEl.textContent = today.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
};

const attachMobileToggle = () => {
  const toggleBtn = document.getElementById('menu-toggle');
  const sidebarEl = document.getElementById('app-sidebar');

  if (toggleBtn && sidebarEl) {
    toggleBtn.addEventListener('click', () => {
      sidebarEl.classList.toggle('mobile-open');
    });

    document.addEventListener('click', (e) => {
      if (sidebarEl.classList.contains('mobile-open') &&
          !sidebarEl.contains(e.target) &&
          !toggleBtn.contains(e.target)) {
        sidebarEl.classList.remove('mobile-open');
      }
    });
  }
};

