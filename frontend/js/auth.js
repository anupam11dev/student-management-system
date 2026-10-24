/**
 * Authentication & Global API Helpers for SMS
 */

const AUTH_TOKEN_KEY = 'sms_token';
const AUTH_USER_KEY = 'sms_user';

const getToken = () => localStorage.getItem(AUTH_TOKEN_KEY);
const getUser = () => {
  const userStr = localStorage.getItem(AUTH_USER_KEY);
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
};

const isAuthenticated = () => !!getToken();

const saveAuth = (token, user) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

const logout = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  window.location.href = 'login.html';
};

/**
 * Route protection guard to include at top of protected pages
 * @param {Array<string>} allowedRoles
 */
const requireAuth = (allowedRoles = []) => {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return false;
  }

  const user = getUser();
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    alert(`Access Denied: You do not have permission to view this page.`);
    window.location.href = 'dashboard.html';
    return false;
  }

  return true;
};

/**
 * Centralized API request wrapper with JWT authorization headers
 */
const apiRequest = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (response.status === 401) {
      // Session expired or invalid token
      logout();
      throw new Error(data.message || 'Session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`[API Error] ${url}:`, error.message);
    throw error;
  }
};

/**
 * Modern floating Toast Notification
 */
const showToast = (message, type = 'info') => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✅' : (type === 'danger' ? '❌' : (type === 'warning' ? '⚠️' : 'ℹ️'));
  toast.innerHTML = `
    <span>${icon}</span>
    <div class="toast-msg">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Export to window for global access
window.smsAuth = {
  getToken,
  getUser,
  isAuthenticated,
  saveAuth,
  logout,
  requireAuth,
  apiRequest,
  showToast
};

