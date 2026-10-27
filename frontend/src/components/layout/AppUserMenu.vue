<script setup>
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth.js";

defineProps({ align: { type: String, default: "up" } });

const router = useRouter();
const { user, logout } = useAuth();
const root = useTemplateRef("root");
const open = ref(false);

const ROLE_LABELS = { OPERATOR: "Operator", SUPERVISOR: "Supervisor" };

function toggle() {
  open.value = !open.value;
}

function handleLogout() {
  open.value = false;
  logout();
  router.push({ name: "login" });
}

function handleClickOutside(event) {
  if (root.value && !root.value.contains(event.target)) open.value = false;
}

onMounted(() => document.addEventListener("click", handleClickOutside));
onBeforeUnmount(() => document.removeEventListener("click", handleClickOutside));
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="focus-ring flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-gray-50"
      :aria-expanded="open"
      @click="toggle"
    >
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-ledger-wash text-ledger-blue"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 19.5c1.2-3.3 4-5 7.5-5s6.3 1.7 7.5 5" />
        </svg>
      </span>
      <span class="hidden min-w-0 flex-1 sm:block">
        <span class="block truncate text-sm font-semibold text-gray-900">
          {{ user?.full_name }}
        </span>
        <span class="block truncate text-xs text-gray-500">
          {{ ROLE_LABELS[user?.role] ?? user?.role }}
        </span>
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4 shrink-0 text-gray-400"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div
      v-show="open"
      :class="[
        'absolute right-0 z-30 w-44 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg shadow-gray-900/10',
        align === 'up' ? 'bottom-full mb-2' : 'top-full mt-2',
      ]"
    >
      <button
        type="button"
        class="focus-ring flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
        @click="handleLogout"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
          aria-hidden="true"
        >
          <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        Keluar
      </button>
    </div>
  </div>
</template>
