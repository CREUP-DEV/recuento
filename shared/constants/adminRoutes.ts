export const ADMIN_ROUTES = {
  dashboard: '/admin',
  login: '/admin/login',
  events: '/admin/events',
  eventDetail: (id: string) => `/admin/events/${id}`,
} as const
