<script setup>
import { onMounted } from "vue";
import { listInventory } from "@/api/client.js";
import { usePagedList } from "@/composables/usePagedList.js";
import { formatDateTime, formatNumber } from "@/utils/format.js";
import PaginationBar from "@/components/PaginationBar.vue";

const { rows, pagination, loading, errorMessage, load } = usePagedList((page) =>
  listInventory({ page }),
);

onMounted(() => load(1));
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold">Stok</h1>
    <p class="text-sm text-slate-500">
      Stok hanya berubah lewat penerimaan barang dan tidak bisa diubah manual.
    </p>

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
            <th class="px-4 py-2 font-medium">SKU</th>
            <th class="px-4 py-2 font-medium">Nama</th>
            <th class="px-4 py-2 text-right font-medium">Stok</th>
            <th class="px-4 py-2 font-medium">Satuan</th>
            <th class="px-4 py-2 font-medium">Terakhir diperbarui</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.product_id"
            class="border-t border-slate-100"
          >
            <td class="px-4 py-2 font-mono">{{ row.sku }}</td>
            <td class="px-4 py-2">{{ row.name }}</td>
            <td
              class="px-4 py-2 text-right font-medium tabular-nums"
              :class="row.on_hand_qty === 0 ? 'text-slate-400' : ''"
            >
              {{ formatNumber(row.on_hand_qty) }}
            </td>
            <td class="px-4 py-2">{{ row.unit }}</td>
            <td class="px-4 py-2 text-slate-500">
              {{ formatDateTime(row.updated_at) }}
            </td>
          </tr>
          <tr v-if="!loading && rows.length === 0">
            <td colspan="5" class="px-4 py-6 text-center text-slate-500">
              Belum ada produk.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginationBar :pagination="pagination" @change="load" />
  </div>
</template>
