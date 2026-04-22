<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { useMediaQuery } from '@vueuse/core'
import { useAuth } from '~/composables/useAuth'
import { getInitials } from '~/utils/initials'
import { ADMIN_ROUTES } from '~~/shared/constants/adminRoutes'

const { t } = useI18n()
const { session, signOut } = useAuth()

const route = useRoute()
const isMobileSidebar = useMediaQuery('(max-width: 1023px)')
const sidebarOpen = useState('admin-sidebar-open', () => true)

const avatarLoadFailed = ref(false)
const adminInitials = computed(() => {
  const source =
    session.value.data?.user?.name?.trim() ||
    session.value.data?.user?.email?.trim() ||
    t('admin.administration')
  return getInitials(source)
})

const navigationCollapsed = computed(() => !sidebarOpen.value && !isMobileSidebar.value)
const toggleSidebarIcon = computed(() => {
  if (isMobileSidebar.value) return 'i-tabler-menu-2'
  return sidebarOpen.value
    ? 'i-tabler-layout-sidebar-left-collapse'
    : 'i-tabler-layout-sidebar-left-expand'
})

const isNavItemActive = (to: string) => {
  if (to === ADMIN_ROUTES.dashboard) return route.path === ADMIN_ROUTES.dashboard
  return route.path === to || route.path.startsWith(`${to}/`)
}

watch(
  () => session.value.data?.user?.image,
  () => {
    avatarLoadFailed.value = false
  }
)

const navigationItems = computed<NavigationMenuItem[][]>(() => [
  [
    {
      label: t('admin.dashboard'),
      to: ADMIN_ROUTES.dashboard,
      icon: 'i-tabler-home',
      active: isNavItemActive(ADMIN_ROUTES.dashboard),
      onSelect: () => {
        if (isMobileSidebar.value) sidebarOpen.value = false
      },
    },
    {
      label: t('admin.events'),
      to: ADMIN_ROUTES.events,
      icon: 'i-tabler-calendar-event',
      active: isNavItemActive(ADMIN_ROUTES.events),
      onSelect: () => {
        if (isMobileSidebar.value) sidebarOpen.value = false
      },
    },
  ],
])

const allNavItems = computed(() => [
  { label: t('admin.dashboard'), to: ADMIN_ROUTES.dashboard },
  { label: t('admin.events'), to: ADMIN_ROUTES.events },
])

const currentPageLabel = computed(
  () => allNavItems.value.find((item) => isNavItemActive(item.to))?.label
)

const toggleSidebarLabel = computed(() =>
  sidebarOpen.value ? t('accessibility.collapseSidebar') : t('accessibility.expandSidebar')
)

useHead({
  titleTemplate: (titleChunk) =>
    titleChunk ? `${titleChunk} | Admin Recuento` : 'Admin Recuento CREUP',
})
</script>

<template>
  <div class="bg-background min-h-screen">
    <a
      href="#admin-main-navigation"
      class="bg-primary text-primary-foreground sr-only z-50 rounded px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
    >
      {{ t('accessibility.skipToNavigation') }}
    </a>
    <a
      href="#admin-main-content"
      class="bg-primary text-primary-foreground sr-only z-50 rounded px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-48"
    >
      {{ t('accessibility.skipToMain') }}
    </a>

    <div class="flex min-h-screen">
      <USidebar
        v-model:open="sidebarOpen"
        collapsible="icon"
        mode="slideover"
        :ui="{
          root: '[--sidebar-width-icon:4.75rem] transition-[width] duration-300 ease-in-out',
          container: 'h-full',
        }"
      >
        <template #header="{ state, close }">
          <div
            :class="[
              'relative flex w-full overflow-visible',
              state === 'expanded' ? 'items-start gap-3 pr-10' : 'items-center justify-center',
            ]"
          >
            <div
              :class="[
                'flex items-center',
                state === 'expanded' ? 'min-w-0 gap-3 overflow-hidden' : 'w-full justify-center',
              ]"
            >
              <div
                class="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg"
              >
                <UIcon name="i-tabler-chart-bar" class="size-5" />
              </div>
              <Transition
                enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 -translate-x-1"
                enter-to-class="opacity-100 translate-x-0"
                leave-active-class="transition-all duration-150 ease-in"
                leave-from-class="opacity-100 translate-x-0"
                leave-to-class="opacity-0 -translate-x-1"
              >
                <div v-if="state === 'expanded'" class="min-w-0">
                  <p class="truncate text-sm font-semibold">{{ t('admin.administration') }}</p>
                </div>
              </Transition>
            </div>
            <UButton
              icon="i-tabler-x"
              variant="ghost"
              class="absolute top-0 -right-1 shrink-0 lg:hidden"
              :aria-label="t('admin.closeSidebar')"
              @click="close"
            />
          </div>
        </template>

        <nav
          id="admin-main-navigation"
          tabindex="-1"
          :aria-label="t('accessibility.mainNavigation')"
        >
          <UNavigationMenu
            :items="navigationItems"
            orientation="vertical"
            :collapsed="navigationCollapsed"
            :tooltip="{ delayDuration: 0, content: { side: 'right' } }"
            :ui="{
              link: 'h-11 px-2.5 text-sm overflow-hidden',
              linkLeadingIcon: 'size-5 shrink-0',
              linkLabel: 'truncate',
            }"
          />
        </nav>

        <template #footer="{ state }">
          <ClientOnly>
            <div
              :class="[
                'flex w-full items-center overflow-hidden',
                state === 'expanded' ? 'gap-3' : 'justify-center',
              ]"
            >
              <img
                v-if="session.data?.user?.image && !avatarLoadFailed"
                :src="session.data.user.image"
                :alt="session.data.user.name ?? t('admin.administration')"
                class="size-8 shrink-0 rounded-full text-xs"
                loading="eager"
                decoding="async"
                referrerpolicy="no-referrer"
                @error="avatarLoadFailed = true"
              />
              <div
                v-else
                class="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                aria-hidden="true"
              >
                {{ adminInitials }}
              </div>
              <Transition
                enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 -translate-x-1"
                enter-to-class="opacity-100 translate-x-0"
                leave-active-class="transition-all duration-150 ease-in"
                leave-from-class="opacity-100 translate-x-0"
                leave-to-class="opacity-0 -translate-x-1"
              >
                <div v-if="state === 'expanded'" class="flex min-w-0 flex-1 items-center gap-1">
                  <div class="min-w-0 flex-1">
                    <p class="line-clamp-2 text-sm leading-tight font-medium">
                      {{ session.data?.user?.name || t('admin.administration') }}
                    </p>
                    <p class="text-muted truncate text-xs">{{ session.data?.user?.email }}</p>
                  </div>
                  <UButton
                    icon="i-tabler-logout"
                    variant="ghost"
                    class="shrink-0"
                    size="sm"
                    :title="t('auth.signOut')"
                    :aria-label="t('auth.signOut')"
                    @click="signOut"
                  />
                </div>
              </Transition>
            </div>
            <template #fallback>
              <div
                :class="[
                  'flex w-full items-center overflow-hidden',
                  state === 'expanded' ? 'gap-3' : 'justify-center',
                ]"
              >
                <div class="bg-muted size-8 shrink-0 rounded-full" aria-hidden="true" />
              </div>
            </template>
          </ClientOnly>
        </template>
      </USidebar>

      <div
        class="bg-default flex min-w-0 flex-1 flex-col overflow-hidden transition-[width] duration-300 ease-in-out"
      >
        <header
          class="border-default flex h-(--ui-header-height) shrink-0 items-center gap-3 border-b px-4"
        >
          <UButton
            :icon="toggleSidebarIcon"
            color="neutral"
            variant="ghost"
            class="shrink-0"
            :aria-label="toggleSidebarLabel"
            :title="toggleSidebarLabel"
            @click="sidebarOpen = !sidebarOpen"
          />
          <Transition
            mode="out-in"
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <div v-if="currentPageLabel" :key="currentPageLabel" class="flex items-center gap-3">
              <USeparator orientation="vertical" class="h-5" />
              <p class="text-sm font-semibold">{{ currentPageLabel }}</p>
            </div>
          </Transition>
          <div class="flex-1" />
          <UColorModeButton />
          <UButton to="/" icon="i-tabler-external-link" variant="ghost" color="neutral" size="sm">
            {{ t('admin.viewSite') }}
          </UButton>
        </header>

        <main id="admin-main-content" tabindex="-1" class="flex-1 p-4 sm:p-6 lg:p-8">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>
