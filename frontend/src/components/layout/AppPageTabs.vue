<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppNavIcon from "@/components/layout/AppNavIcon.vue";
import { NAV_ITEMS, isNavItemActive } from "@/constants/nav.js";

const route = useRoute();
const activeRouteName = computed(() => route.name);
</script>

<template>
  <div class="flex gap-1.5 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm shadow-gray-900/5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <RouterLink
      v-for="item in NAV_ITEMS"
      :key="item.routeName"
      :to="{ name: item.routeName }"
      :class="[
        'focus-ring flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
        isNavItemActive(item, activeRouteName)
          ? 'bg-ledger-blue text-white shadow-sm shadow-sky-900/15'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
      ]"
    >
      <AppNavIcon :name="item.icon" />
      {{ item.tabLabel }}
    </RouterLink>
  </div>
</template>
