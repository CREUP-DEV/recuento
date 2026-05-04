<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface AdminAccessItem {
  id: string
  databaseId: string | null
  email: string
  name: string | null
  image: string | null
  active: boolean
  protectedByEnv: boolean
  source: 'env' | 'database' | 'both'
  lastAccessAt: string | null
}

interface AdminAccessResponse {
  data: AdminAccessItem[]
  meta: {
    total: number
    active: number
    env: number
  }
}

const { t } = useI18n()
const toast = useToast()
const { data, pending, refresh } = await useFetch<AdminAccessResponse>('/api/admin/access')

const items = computed(() => data.value?.data ?? [])
const meta = computed(() => data.value?.meta ?? { total: 0, active: 0, env: 0 })
const email = ref('')
const isSubmitting = ref(false)
const busyId = ref<string | null>(null)

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatLastAccess(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : t('admin.accessNeverUsed')
}

function sourceLabel(item: AdminAccessItem) {
  if (item.source === 'both') return t('admin.accessSourceBoth')
  if (item.source === 'env') return t('admin.accessSourceEnv')
  return t('admin.accessSourceDatabase')
}

async function addAccess() {
  const value = email.value.trim().toLowerCase()
  if (!value) return

  isSubmitting.value = true
  try {
    await $fetch('/api/admin/access', {
      method: 'POST',
      body: { email: value, active: true },
    })
    email.value = ''
    toast.add({ title: t('admin.toasts.accessCreated'), color: 'success' })
    await refresh()
  } catch {
    toast.add({
      title: t('admin.toasts.accessCreateError'),
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}

async function toggleAccess(item: AdminAccessItem) {
  if (!item.databaseId) return

  busyId.value = item.id
  try {
    await $fetch(`/api/admin/access/${item.databaseId}`, {
      method: 'PUT',
      body: { active: !item.active },
    })
    toast.add({ title: t('admin.toasts.accessUpdated'), color: 'success' })
    await refresh()
  } catch {
    toast.add({
      title: t('admin.toasts.accessUpdateError'),
      color: 'error',
    })
  } finally {
    busyId.value = null
  }
}

async function deleteAccess(item: AdminAccessItem) {
  if (!item.databaseId) return

  busyId.value = item.id
  try {
    await $fetch(`/api/admin/access/${item.databaseId}`, { method: 'DELETE' })
    toast.add({ title: t('admin.toasts.accessDeleted'), color: 'success' })
    await refresh()
  } catch {
    toast.add({
      title: t('admin.toasts.accessDeleteError'),
      color: 'error',
    })
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="animate-fade-slide-up space-y-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('admin.access') }}</h1>
      <p class="text-muted mt-2 max-w-3xl text-sm">{{ t('admin.accessDescription') }}</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div class="border-default bg-default rounded-xl border p-4">
        <p class="text-muted text-sm">{{ t('admin.accessTotal') }}</p>
        <p class="mt-2 text-2xl font-semibold">{{ meta.total }}</p>
      </div>
      <div class="border-default bg-default rounded-xl border p-4">
        <p class="text-muted text-sm">{{ t('admin.accessActive') }}</p>
        <p class="mt-2 text-2xl font-semibold">{{ meta.active }}</p>
      </div>
      <div class="border-default bg-default rounded-xl border p-4">
        <p class="text-muted text-sm">{{ t('admin.accessEnv') }}</p>
        <p class="mt-2 text-2xl font-semibold">{{ meta.env }}</p>
      </div>
    </div>

    <form
      class="border-default bg-default flex flex-col gap-3 rounded-xl border p-4 sm:flex-row"
      @submit.prevent="addAccess"
    >
      <UInput
        v-model="email"
        type="email"
        class="min-w-0 flex-1"
        :placeholder="t('admin.accessEmailPlaceholder')"
        :aria-label="t('admin.accessEmailPlaceholder')"
      />
      <UButton type="submit" icon="i-tabler-plus" :loading="isSubmitting" :disabled="!email.trim()">
        {{ t('admin.accessAdd') }}
      </UButton>
    </form>

    <div v-if="pending" class="space-y-3" aria-hidden="true">
      <USkeleton v-for="n in 3" :key="n" class="h-24 rounded-xl" />
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in items"
        :key="item.id"
        class="border-default bg-default flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-semibold break-all">{{ item.email }}</p>
            <UBadge :color="item.active ? 'success' : 'neutral'" variant="soft">
              {{ item.active ? t('admin.accessActiveBadge') : t('admin.accessInactiveBadge') }}
            </UBadge>
            <UBadge color="info" variant="soft">{{ sourceLabel(item) }}</UBadge>
          </div>
          <p class="text-muted mt-1 text-sm">
            {{ item.name || t('admin.accessPendingLogin') }}
          </p>
          <p class="text-muted text-sm">
            {{ t('admin.accessLastAccess') }}: {{ formatLastAccess(item.lastAccessAt) }}
          </p>
        </div>

        <div class="flex shrink-0 gap-2">
          <UButton
            v-if="item.databaseId"
            variant="outline"
            color="neutral"
            :loading="busyId === item.id"
            @click="toggleAccess(item)"
          >
            {{ item.active ? t('admin.accessDisable') : t('admin.accessEnable') }}
          </UButton>
          <UButton
            v-if="item.databaseId && !item.protectedByEnv"
            icon="i-tabler-trash"
            color="error"
            variant="ghost"
            :aria-label="t('admin.accessDelete')"
            :loading="busyId === item.id"
            @click="deleteAccess(item)"
          />
        </div>
      </div>

      <p v-if="!items.length" class="text-muted py-10 text-center">{{ t('admin.accessEmpty') }}</p>
    </div>
  </div>
</template>
