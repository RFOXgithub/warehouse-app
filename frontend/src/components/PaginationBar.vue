<script setup>
import { formatNumber } from "@/utils/format.js";

defineProps({ pagination: { type: Object, required: true } });
defineEmits(["change"]);
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <span class="text-sm text-gray-500">{{ formatNumber(pagination.total) }} data</span>
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="focus-ring flex size-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="pagination.page <= 1"
        aria-label="Halaman sebelumnya"
        @click="$emit('change', pagination.page - 1)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>
      <span class="flex size-8 items-center justify-center rounded-lg bg-ledger-blue text-sm font-semibold text-white">
        {{ pagination.page }}
      </span>
      <button
        type="button"
        class="focus-ring flex size-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="pagination.page >= pagination.total_pages"
        aria-label="Halaman berikutnya"
        @click="$emit('change', pagination.page + 1)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </div>
  </div>
</template>
