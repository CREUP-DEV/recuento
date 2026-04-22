<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({ title: () => t('localVote.title'), robots: 'noindex' })

const {
  state,
  totalVotes,
  addOption,
  removeOption,
  incrementOption,
  decrementOption,
  setCount,
  updateColor,
  resetCounts,
  clearAll,
} = useLocalVote()

const { flashingOptionId } = useVoteKeyboard(
  computed(() => state.value.options),
  incrementOption,
  computed(() => state.value.open),
  decrementOption
)

const isEditingName = ref(false)
const nameInput = ref(state.value.name)

function confirmName() {
  if (nameInput.value.trim()) state.value.name = nameInput.value.trim()
  else nameInput.value = state.value.name
  isEditingName.value = false
}

const newOptionLabel = ref('')

function addOptionAndReset() {
  if (!newOptionLabel.value.trim()) return
  addOption(newOptionLabel.value.trim())
  newOptionLabel.value = ''
}

const showClearConfirm = ref(false)

const activeShortcuts = computed(() =>
  state.value.options
    .map((option) => option.shortcut)
    .filter((shortcut): shortcut is string => Boolean(shortcut))
)
</script>

<template>
  <div class="animate-fade-slide-up mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
    <!-- Header -->
    <div class="mb-8 flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <!-- Editable name -->
        <h1
          v-if="!isEditingName"
          class="font-heading group inline-flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl"
        >
          <button
            type="button"
            class="focus-visible:ring-primary/60 rounded-sm bg-transparent text-left focus-visible:ring-2 focus-visible:outline-none"
            :aria-label="t('localVote.editName')"
            :title="t('localVote.editName')"
            @click="
              () => {
                nameInput = state.name
                isEditingName = true
              }
            "
          >
            <span
              class="border-b-2 border-dashed border-transparent pb-0.5 transition-colors group-hover:border-current"
            >
              {{ state.name }}
            </span>
          </button>
          <UIcon
            name="i-tabler-pencil"
            class="text-muted size-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          />
        </h1>
        <UInput
          v-else
          v-model="nameInput"
          size="xl"
          class="text-2xl font-bold"
          autofocus
          @blur="confirmName"
          @keydown.enter.prevent="confirmName"
          @keydown.escape.prevent="
            () => {
              nameInput = state.name
              isEditingName = false
            }
          "
        />

        <div class="mt-3 flex items-center gap-3">
          <VoteStatus :open="state.open" />
        </div>
      </div>

      <!-- Total -->
      <div class="shrink-0 text-right">
        <p class="text-muted text-sm">{{ t('localVote.total') }}</p>
        <p class="font-mono text-3xl font-bold tabular-nums">{{ totalVotes }}</p>
      </div>
    </div>

    <!-- Options -->
    <div class="border-default bg-default mb-6 overflow-hidden rounded-2xl border shadow-sm">
      <div v-if="state.options.length > 0" class="divide-default divide-y">
        <LocalVoteOptionBar
          v-for="option in state.options"
          :key="option.id"
          :option="option"
          :total="totalVotes"
          :flashing="flashingOptionId === option.id"
          @increment="incrementOption(option.id)"
          @decrement="decrementOption(option.id)"
          @delete="removeOption(option.id)"
          @set-count="(count) => setCount(option.id, count)"
          @update-color="(color) => updateColor(option.id, color)"
        />
      </div>
      <div v-else class="py-12 text-center">
        <UIcon name="i-tabler-chart-bar-off" class="text-muted mx-auto size-10" />
        <p class="text-muted mt-3 text-sm">{{ t('localVote.empty') }}</p>
      </div>

      <!-- Add option -->
      <div class="border-default border-t p-4">
        <div class="flex gap-2">
          <UInput
            v-model="newOptionLabel"
            :placeholder="t('localVote.newOptionPlaceholder')"
            class="flex-1"
            @keydown.enter.prevent="addOptionAndReset"
          />
          <UButton
            icon="i-tabler-plus"
            color="primary"
            :disabled="!newOptionLabel.trim()"
            @click="addOptionAndReset"
          >
            {{ t('localVote.addOption') }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex flex-wrap items-center gap-3">
      <UButton
        :icon="state.open ? 'i-tabler-player-stop' : 'i-tabler-player-play'"
        :color="state.open ? 'error' : 'success'"
        variant="subtle"
        @click="state.open = !state.open"
      >
        {{ state.open ? t('localVote.close') : t('localVote.open') }}
      </UButton>

      <UButton
        icon="i-tabler-rotate"
        variant="subtle"
        color="neutral"
        :disabled="totalVotes === 0"
        @click="resetCounts"
      >
        {{ t('localVote.resetCounts') }}
      </UButton>

      <UButton
        icon="i-tabler-trash"
        variant="subtle"
        color="error"
        @click="showClearConfirm = true"
      >
        {{ t('localVote.clearAll') }}
      </UButton>

      <!-- Keyboard hint -->
      <span
        v-if="state.open && activeShortcuts.length > 0"
        class="text-muted ml-auto flex items-center gap-1.5 text-xs"
      >
        <UIcon name="i-tabler-keyboard" class="size-3.5" />
        {{ t('localVote.keyboardHint') }}
        <span v-for="shortcut in activeShortcuts" :key="shortcut">
          <kbd class="bg-muted rounded px-1 py-0.5 font-mono">{{ shortcut }}</kbd>
        </span>
        · <kbd class="bg-muted rounded px-1.5 py-0.5 font-mono">⌫</kbd>
      </span>
    </div>

    <!-- Clear confirm modal -->
    <UModal v-model:open="showClearConfirm">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold">{{ t('localVote.clearTitle') }}</h3>
          <p class="text-muted mt-2">{{ t('localVote.clearDescription') }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <UButton variant="ghost" color="neutral" @click="showClearConfirm = false">
              {{ t('admin.cancel') }}
            </UButton>
            <UButton
              color="error"
              @click="
                () => {
                  clearAll()
                  showClearConfirm = false
                }
              "
            >
              {{ t('localVote.clearAll') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
