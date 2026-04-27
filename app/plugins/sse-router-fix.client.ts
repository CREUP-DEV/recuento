export default defineNuxtPlugin(() => {
  const router = useRouter()
  // Prevent Vue Router from warning about Nitro-internal SSE paths
  router.beforeEach((to) => {
    if (to.path === '/__server_sent_events__') return false
  })
})
