export const ADMIN_ROUTES = {
  dashboard: '/admin',
  login: '/admin/login',
  access: '/admin/access',
  events: '/admin/events',
  eventDetail: (id: string) => `/admin/events/${id}`,
} as const
