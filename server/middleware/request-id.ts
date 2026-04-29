import { randomUUID } from 'node:crypto'

export default defineEventHandler((event) => {
  const requestId = getRequestHeader(event, 'x-request-id')?.trim() || randomUUID()

  event.context.requestId = requestId
  setResponseHeader(event, 'x-request-id', requestId)
})
