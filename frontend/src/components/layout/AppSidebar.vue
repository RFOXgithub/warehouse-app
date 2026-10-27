<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppNavIcon from "@/components/layout/AppNavIcon.vue";
import { NAV_ITEMS, isNavItemActive } from "@/constants/nav.js";

defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(["close"]);

const route = useRoute();
const activeRouteName = computed(() => route.name);
</script>

<template>
  <div
    v-show="open"
    class="fixed inset-0 z-30 bg-gray-900/40 lg:hidden"
    aria-hidden="true"
    @click="emit('close')"
  />

  <aside
    :class="[
      'fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col border-r border-gray-100 bg-white transition-transform duration-200 ease-fluid lg:static lg:z-0 lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full',
    ]"
  >
    <div class="flex items-center justify-between px-6 pt-6 pb-5">
      <img
        src="/tcl-logo-full.png"
        width="228"
        height="54"
        alt="PT. Tirtamas Coldstorindo Logistik"
        class="h-auto w-40"
      />
      <button
        type="button"
        class="focus-ring -mr-1.5 flex size-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 lg:hidden"
        aria-label="Tutup menu"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="size-5">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>

    <nav class="flex-1 space-y-1 px-4">
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.routeName"
        :to="{ name: item.routeName }"
        :class="[
          'focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isNavItemActive(item, activeRouteName)
            ? 'bg-ledger-blue text-white shadow-sm shadow-sky-900/15'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
        ]"
        @click="emit('close')"
      >
        <AppNavIcon :name="item.icon" />
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>
