<script setup>
import { formatNumber } from "@/utils/format.js";

defineProps({ pagination: { type: Object, required: true } });
defineEmits(["change"]);
</script>

<template>
  <div class="flex items-center justify-between gap-4 text-sm text-slate-600">
    <span>{{ formatNumber(pagination.total) }} data</span>
    <div v-if="pagination.total_pages > 1" class="flex items-center gap-2">
      <button
        type="button"
        class="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
        :disabled="pagination.page <= 1"
        @click="$emit('change', pagination.page - 1)"
      >
        Sebelumnya
      </button>
      <span
        >Halaman {{ pagination.page }} dari {{ pagination.total_pages }}</span
      >
      <button
        type="button"
        class="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
        :disabled="pagination.page >= pagination.total_pages"
        @click="$emit('change', pagination.page + 1)"
      >
        Berikutnya
      </button>
    </div>
  </div>
</template>
