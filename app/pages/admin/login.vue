<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { ADMIN_ROUTES } from '~~/shared/constants/adminRoutes'

definePageMeta({
  layout: false,
  title: 'Acceso',
})

const { signInWithGoogle, signOut, session } = useAuth()
const route = useRoute()
const isLoading = ref(false)
const error = ref<string | null>(null)
const isCheckingAccess = ref(false)
const isLoggedIn = computed(() => Boolean(session.value.data?.user))

const verifyAdminAccess = async () => {
  if (!session.value.data?.user) {
    return
  }

  isCheckingAccess.value = true

  try {
    await $fetch('/api/admin/session')
    await navigateTo(ADMIN_ROUTES.dashboard)
  } catch {
    error.value = 'No tienes permiso para acceder a esta página'
  } finally {
    isCheckingAccess.value = false
  }
}

watch(
  () => route.query.error,
  (queryError) => {
    if (typeof queryError === 'string' && queryError.length > 0) {
      error.value = 'No se pudo completar el inicio de sesión con la cuenta seleccionada'
    }
  },
  { immediate: true }
)

watch(
  () => session.value.data?.user,
  async (user) => {
    if (user) {
      await verifyAdminAccess()
    }
  },
  { immediate: true }
)

const handleLogin = async () => {
  try {
    isLoading.value = true
    error.value = null
    await signInWithGoogle()
  } catch {
    error.value = 'No se ha podido iniciar sesión en este momento'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="from-creup-beige-50 via-background to-creup-red-50/40 dark:from-creup-dark-gray-950 dark:via-background dark:to-creup-red-950/20 flex min-h-screen items-center justify-center bg-linear-to-br p-4"
  >
    <div class="animate-fade-slide-up w-full max-w-md">
      <div class="border-default/80 bg-default overflow-hidden rounded-2xl border shadow-xl">
        <div
          class="from-creup-red-900 via-creup-red-800 to-creup-blue-950 bg-linear-to-br px-8 py-10 text-center text-white"
        >
          <img
            src="/nav/creup-site-header-logo-dark.svg"
            :alt="$t('app.title')"
            class="mx-auto h-10 w-auto"
          />
          <h1 class="font-heading mt-4 text-2xl font-bold">{{ $t('auth.title') }}</h1>
          <p class="mt-2 text-white/80">{{ $t('auth.subtitle') }}</p>
        </div>

        <div class="p-8">
          <UAlert v-if="error" color="error" :title="error" class="mb-4" />

          <UButton
            block
            size="xl"
            color="neutral"
            variant="solid"
            icon="i-tabler-brand-google"
            class="justify-center"
            :loading="isLoading"
            :disabled="isCheckingAccess || isLoggedIn"
            @click="handleLogin"
          >
            {{ $t('auth.signInWithGoogle') }}
          </UButton>

          <p v-if="isCheckingAccess" class="text-muted mt-4 text-center text-sm">
            {{ $t('auth.verifyingAccess') }}
          </p>

          <UButton
            v-if="isLoggedIn && !isCheckingAccess && error"
            block
            variant="ghost"
            icon="i-tabler-logout"
            class="mt-4"
            @click="signOut"
          >
            {{ $t('auth.signOut') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
