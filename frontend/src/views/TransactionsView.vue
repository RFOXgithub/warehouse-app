<script setup>
import { onMounted, ref, watch } from "vue";
import { listInventoryTransactions, listProducts } from "@/api/client.js";
import { usePagedList } from "@/composables/usePagedList.js";
import { formatDateTime, formatNumber } from "@/utils/format.js";
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
  <div class="space-y-4">
    <h1 class="text-xl font-semibold">Riwayat Stok</h1>

    <label class="flex max-w-sm flex-col gap-1 text-sm">
      <span class="font-medium">Produk</span>
      <select
        v-model="productId"
        class="rounded-md border border-slate-300 px-3 py-2"
      >
        <option value="">Semua produk</option>
        <option
          v-for="product in products"
          :key="product.id"
          :value="product.id"
        >
          {{ product.sku }} — {{ product.name }}
        </option>
      </select>
    </label>

    <p
      v-if="errorMessage"
      role="alert"
      class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {{ errorMessage }}
    </p>

    <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-slate-600">
          <tr>
            <th class="px-4 py-2 font-medium">Waktu</th>
            <th class="px-4 py-2 font-medium">Produk</th>
            <th class="px-4 py-2 text-right font-medium">Jumlah</th>
            <th class="px-4 py-2 text-right font-medium">Stok setelahnya</th>
            <th class="px-4 py-2 font-medium">No. Receipt</th>
            <th class="px-4 py-2 font-medium">No. Dokumen</th>
            <th class="px-4 py-2 font-medium">Oleh</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in rows" :key="t.id" class="border-t border-slate-100">
            <td class="px-4 py-2 whitespace-nowrap text-slate-500">
              {{ formatDateTime(t.created_at) }}
            </td>
            <td class="px-4 py-2">
              <span class="font-mono">{{ t.sku }}</span>
              <span class="text-slate-500"> · {{ t.product_name }}</span>
            </td>
            <td
              class="px-4 py-2 text-right font-medium text-green-700 tabular-nums"
            >
              +{{ formatNumber(t.quantity) }}
            </td>
            <td class="px-4 py-2 text-right tabular-nums">
              {{ formatNumber(t.balance_after) }}
            </td>
            <td class="px-4 py-2 font-mono whitespace-nowrap">
              {{ t.receipt_number }}
            </td>
            <td class="px-4 py-2 font-mono whitespace-nowrap">
              {{ t.doc_number }}
            </td>
            <td class="px-4 py-2">{{ t.created_by.full_name }}</td>
          </tr>
          <tr v-if="!loading && rows.length === 0">
            <td colspan="7" class="px-4 py-6 text-center text-slate-500">
              Belum ada transaksi.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginationBar :pagination="pagination" @change="load" />
  </div>
</template>
