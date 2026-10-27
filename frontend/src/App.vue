<script setup>
import { computed, ref, watch } from "vue";
import { RouterView, useRoute } from "vue-router";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import AppTopbar from "@/components/layout/AppTopbar.vue";
import AppBrandStripes from "@/components/layout/AppBrandStripes.vue";

const route = useRoute();
const pageTitle = computed(() => route.meta.title ?? "Penerimaan Barang");

const sidebarOpen = ref(false);
watch(() => route.fullPath, () => {
  sidebarOpen.value = false;
});
</script>

<template>
  <RouterView v-if="route.meta.public" />

  <div v-else class="flex min-h-dvh bg-ledger-wash font-display lg:h-dvh lg:overflow-hidden">
    <AppSidebar :open="sidebarOpen" @close="sidebarOpen = false" />

    <div class="relative flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
      <AppTopbar :title="pageTitle" @toggle-sidebar="sidebarOpen = !sidebarOpen" />

      <main class="relative z-10 flex-1 px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8">
        <RouterView />
      </main>

      <AppBrandStripes />
    </div>
  </div>
</template>
