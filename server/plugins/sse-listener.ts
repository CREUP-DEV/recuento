import { startSSEPostgresListener } from '../utils/sseManager'

export default defineNitroPlugin(() => {
  void startSSEPostgresListener()
})
