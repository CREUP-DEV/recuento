import { listAdminAccess } from '#server-utils/adminAccess'

export default defineEventHandler(async () => {
  const { items, summary } = await listAdminAccess()

  return {
    data: items,
    meta: summary,
  }
})
