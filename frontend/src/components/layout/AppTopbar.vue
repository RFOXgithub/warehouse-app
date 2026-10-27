<script setup>
import AppUserMenu from "@/components/layout/AppUserMenu.vue";

defineProps({ title: { type: String, required: true } });
defineEmits(["toggle-sidebar"]);
</script>

<template>
  <header class="flex items-start justify-between gap-3 px-4 pt-5 pb-4 sm:px-6 sm:pt-6 lg:px-8">
    <div class="flex min-w-0 items-start gap-3">
      <button
        type="button"
        class="focus-ring mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-white lg:hidden"
        aria-label="Buka menu"
        @click="$emit('toggle-sidebar')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="size-5">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div class="min-w-0">
        <h1 class="truncate text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{{ title }}</h1>
        <nav class="mt-1 flex items-center gap-1.5 text-sm text-gray-400" aria-label="Breadcrumb">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4 shrink-0"
            aria-hidden="true"
          >
            <path d="M4 10.5 12 4l8 6.5" />
            <path d="M6 9.5V20h12V9.5" />
          </svg>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            class="size-3.5 shrink-0 text-gray-300"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
          <span class="truncate text-gray-500">{{ title }}</span>
        </nav>
      </div>
    </div>

    <div class="w-auto shrink-0 sm:w-56">
      <AppUserMenu align="down" />
    </div>
  </header>
</template>
