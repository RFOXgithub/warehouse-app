<script setup>
import { onMounted, ref, watch } from "vue";
import { listInventoryTransactions, listProducts } from "@/api/client.js";
import { usePagedList } from "@/composables/usePagedList.js";
import { formatDateTime, formatNumber } from "@/utils/format.js";
import AppPageTabs from "@/components/layout/AppPageTabs.vue";
import AppNavIcon from "@/components/layout/AppNavIcon.vue";
import BaseAlert from "@/components/base/BaseAlert.vue";
import PaginationBar from "@/components/PaginationBar.vue";

const productId = ref("");
const products = ref([]);

const { rows, pagination, loading, errorMessage, load } = usePagedList((page) =>
  listInventoryTransactions({ page, product_id: productId.value }),
);

watch(productId, () => load(1));

onMounted(async () => {
  load(1);
  const { data } = await listProducts({ page_size: 100 });
  products.value = data;
});
</script>

<template>
  <div class="space-y-5">
    <AppPageTabs />

    <div class="rounded-2xl border border-ledger-tint/70 bg-ledger-wash p-4 sm:rounded-3xl sm:p-6">
      <div class="flex items-start gap-3">
        <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-ledger-blue shadow-sm">
          <AppNavIcon name="clock" />
        </span>
        <div>
          <h2 class="text-lg font-bold text-gray-900">Riwayat Stok</h2>
          <p class="text-sm text-gray-500">Semua pergerakan stok dari penerimaan barang.</p>
        </div>
      </div>

      <label class="mt-5 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 sm:max-w-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0 text-gray-400">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        <select v-model="productId" class="w-full bg-transparent text-sm font-medium text-gray-700 focus:outline-none">
          <option value="">Semua produk</option>
          <option v-for="product in products" :key="product.id" :value="product.id">
            {{ product.sku }} — {{ product.name }}
          </option>
        </select>
      </label>

      <BaseAlert v-if="errorMessage" variant="error" class="mt-4">{{ errorMessage }}</BaseAlert>

      <div class="mt-5 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table class="w-full text-left text-sm">
          <thead class="text-gray-500">
            <tr class="border-b border-gray-100">
              <th class="px-5 py-3 font-medium">Waktu</th>
              <th class="px-5 py-3 font-medium">Produk</th>
              <th class="px-5 py-3 font-medium">Jumlah</th>
              <th class="px-5 py-3 font-medium">Stok setelahnya</th>
              <th class="px-5 py-3 font-medium">No. Receipt</th>
              <th class="px-5 py-3 font-medium">No. Dokumen</th>
              <th class="px-5 py-3 font-medium">Oleh</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in rows" :key="t.id" class="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
              <td class="px-5 py-4 whitespace-nowrap text-gray-500">{{ formatDateTime(t.created_at) }}</td>
              <td class="px-5 py-4">
                <span class="font-mono font-medium text-gray-900">{{ t.sku }}</span>
                <span class="text-gray-500"> · {{ t.product_name }}</span>
              </td>
              <td class="px-5 py-4 font-semibold tabular-nums text-green-700">+{{ formatNumber(t.quantity) }}</td>
              <td class="px-5 py-4 tabular-nums text-gray-700">{{ formatNumber(t.balance_after) }}</td>
              <td class="px-5 py-4 font-mono whitespace-nowrap text-gray-700">{{ t.receipt_number }}</td>
              <td class="px-5 py-4 font-mono whitespace-nowrap text-gray-700">{{ t.doc_number }}</td>
              <td class="px-5 py-4 text-gray-700">{{ t.created_by.full_name }}</td>
            </tr>
            <tr v-if="!loading && rows.length === 0">
              <td colspan="7" class="px-5 py-10 text-center text-gray-400">Belum ada transaksi.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <PaginationBar class="mt-4" :pagination="pagination" @change="load" />
    </div>
  </div>
</template>
