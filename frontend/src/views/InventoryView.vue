<script setup>
import { onMounted } from "vue";
import { listInventory } from "@/api/client.js";
import { usePagedList } from "@/composables/usePagedList.js";
import { formatDateTime, formatNumber } from "@/utils/format.js";
import AppPageTabs from "@/components/layout/AppPageTabs.vue";
import AppNavIcon from "@/components/layout/AppNavIcon.vue";
import BaseAlert from "@/components/base/BaseAlert.vue";
import PaginationBar from "@/components/PaginationBar.vue";

const { rows, pagination, loading, errorMessage, load } = usePagedList((page) =>
  listInventory({ page }),
);

onMounted(() => load(1));
</script>

<template>
  <div class="space-y-5">
    <AppPageTabs />

    <div class="rounded-2xl border border-ledger-tint/70 bg-ledger-wash p-4 sm:rounded-3xl sm:p-6">
      <div class="flex items-start gap-3">
        <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-ledger-blue shadow-sm">
          <AppNavIcon name="archive" />
        </span>
        <div>
          <h2 class="text-lg font-bold text-gray-900">Stok</h2>
          <p class="text-sm text-gray-500">
            Stok hanya berubah lewat penerimaan barang dan tidak bisa diubah manual.
          </p>
        </div>
      </div>

      <BaseAlert v-if="errorMessage" variant="error" class="mt-4">{{ errorMessage }}</BaseAlert>

      <div class="mt-5 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table class="w-full text-left text-sm">
          <thead class="text-gray-500">
            <tr class="border-b border-gray-100">
              <th class="px-5 py-3 font-medium">SKU</th>
              <th class="px-5 py-3 font-medium">Nama</th>
              <th class="px-5 py-3 font-medium">Stok</th>
              <th class="px-5 py-3 font-medium">Satuan</th>
              <th class="px-5 py-3 font-medium">Terakhir diperbarui</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.product_id"
              class="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
            >
              <td class="px-5 py-4 font-mono font-medium text-gray-900">{{ row.sku }}</td>
              <td class="px-5 py-4 text-gray-700">{{ row.name }}</td>
              <td
                class="px-5 py-4 font-semibold tabular-nums"
                :class="row.on_hand_qty === 0 ? 'text-gray-400' : 'text-gray-900'"
              >
                {{ formatNumber(row.on_hand_qty) }}
              </td>
              <td class="px-5 py-4 text-gray-700">{{ row.unit }}</td>
              <td class="px-5 py-4 text-gray-500">{{ formatDateTime(row.updated_at) }}</td>
            </tr>
            <tr v-if="!loading && rows.length === 0">
              <td colspan="5" class="px-5 py-10 text-center text-gray-400">Belum ada produk.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <PaginationBar class="mt-4" :pagination="pagination" @change="load" />
    </div>
  </div>
</template>
