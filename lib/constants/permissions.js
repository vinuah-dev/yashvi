// Permission constants for role-based access control

export const PERMISSIONS = {
  DASHBOARD: 'dashboard',
  MEMBERS: 'members',
  ATTENDANCE: 'attendance',
  ANNOUNCEMENTS: 'announcements',
  FINANCE: 'finance',
  ANALYTICS: 'analytics',
  MONITORING: 'monitoring',
  SETTINGS: 'settings',
  INQUIRIES: 'inquiries',
};

// Map permissions to their routes
export const PERMISSION_ROUTES = {
  dashboard: ['/admin/dashboard'],
  members: ['/members'],
  attendance: ['/attendance'],
  announcements: ['/announcements', '/admin/knowledge'],
  finance: ['/finance'],
  analytics: ['/analytics'],
  monitoring: ['/monitoring'],
  settings: ['/settings'],
  inquiries: ['/inquiries'],
};

// Owner has all permissions (cannot be restricted)
export const OWNER_PERMISSIONS = {
  dashboard: true,
  members: true,
  attendance: true,
  announcements: true,
  finance: true,
  analytics: true,
  monitoring: true,
  settings: true,
  inquiries: true,
};

/**
 * Check if user has a specific permission
 * @param {Object} permissions - User's permissions object
 * @param {string} permission - Permission key to check
 * @returns {boolean}
 */
export function hasPermission(permissions, permission) {
  if (!permissions || typeof permissions !== 'object') {
    return false;
  }
  return permissions[permission] === true;
}

/**
 * Check if user has access to a route
 * @param {Object} permissions - User's permissions object
 * @param {string} pathname - Route pathname
 * @returns {boolean}
 */
export function hasRouteAccess(permissions, pathname) {
  // Check each permission's routes
  for (const [permission, routes] of Object.entries(PERMISSION_ROUTES)) {
    const hasRoute = routes.some(route => pathname.startsWith(route));
    if (hasRoute) {
      return hasPermission(permissions, permission);
    }
  }
  return true;
}
