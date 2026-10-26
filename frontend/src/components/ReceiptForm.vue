<script setup>
import { computed, reactive, ref, watch } from "vue";
import { createReceipt } from "@/api/client.js";
import { newIdempotencyKey } from "@/utils/idempotency.js";
import { formatNumber } from "@/utils/format.js";

const props = defineProps({
  documentId: { type: Number, required: true },
  items: { type: Array, required: true },
});
const emit = defineEmits(["received", "refresh"]);

const openItems = computed(() =>
  props.items.filter((item) => item.remaining_qty > 0),
);

const quantities = reactive({});
const notes = ref("");
const submitting = ref(false);
const errorMessage = ref("");
const errorDetails = ref([]);
const lineErrors = ref({});

const idempotencyKey = ref(newIdempotencyKey());
watch(
  [quantities, notes],
  () => {
    idempotencyKey.value = newIdempotencyKey();
  },
  { deep: true },
);

function buildLines() {
  return openItems.value
    .map((item) => ({
      item_id: item.id,
      quantity: Number(quantities[item.id] || 0),
    }))
    .filter((line) => line.quantity !== 0);
}

async function handleSubmit() {
  if (submitting.value) return;
  errorMessage.value = "";
  errorDetails.value = [];
  lineErrors.value = {};

  const lines = buildLines();
  if (lines.length === 0) {
    errorMessage.value = "Isi jumlah diterima minimal untuk 1 item.";
    return;
  }

  submitting.value = true;
  try {
    const result = await createReceipt(
      props.documentId,
      { notes: notes.value, lines },
      idempotencyKey.value,
    );
    for (const id of Object.keys(quantities)) quantities[id] = "";
    notes.value = "";
    emit("received", { receipt: result.data, replayed: result.status === 200 });
  } catch (error) {
    errorMessage.value = error.message;
    const byItem = {};
    for (const detail of error.details) {
      if (detail.item_id) byItem[detail.item_id] = detail.message;
      else if (detail.message) errorDetails.value.push(detail.message);
    }
    lineErrors.value = byItem;
    if (error.status === 409 || error.status === 422) emit("refresh");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="space-y-2">
    <h2 class="font-medium">Catat Penerimaan</h2>

    <p
      v-if="openItems.length === 0"
      class="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600"
    >
      Semua item sudah diterima penuh. Supervisor dapat menandai dokumen
      selesai.
    </p>

    <form
      v-else
      class="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      @submit.prevent="handleSubmit"
    >
      <div
        v-if="errorMessage"
        role="alert"
        class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        <p>{{ errorMessage }}</p>
        <ul v-if="errorDetails.length" class="mt-1 list-disc pl-5">
          <li v-for="message in errorDetails" :key="message">{{ message }}</li>
        </ul>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-slate-600">
            <tr>
              <th class="py-2 pr-4 font-medium">SKU</th>
              <th class="py-2 pr-4 font-medium">Produk</th>
              <th class="py-2 pr-4 text-right font-medium">Sisa</th>
              <th class="py-2 text-right font-medium">Terima sekarang</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in openItems"
              :key="item.id"
              class="border-t border-slate-100 align-top"
            >
              <td class="py-2 pr-4 font-mono whitespace-nowrap">
                {{ item.sku }}
              </td>
              <td class="py-2 pr-4">{{ item.product_name }}</td>
              <td class="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                {{ formatNumber(item.remaining_qty) }} {{ item.unit }}
              </td>
              <td class="py-2 text-right">
                <input
                  v-model="quantities[item.id]"
                  type="number"
                  min="0"
                  :max="item.remaining_qty"
                  step="1"
                  placeholder="0"
                  :aria-label="`Terima sekarang ${item.sku}`"
                  class="w-28 rounded-md border px-2 py-1 text-right"
                  :class="
                    lineErrors[item.id] ? 'border-red-400' : 'border-slate-300'
                  "
                />
                <p v-if="lineErrors[item.id]" class="mt-1 text-red-600">
                  {{ lineErrors[item.id] }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <label class="block space-y-1">
        <span class="text-sm font-medium"
          >Catatan (opsional, misalnya nomor polisi truk)</span
        >
        <input
          v-model="notes"
          maxlength="500"
          class="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <button
        type="submit"
        :disabled="submitting"
        class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {{ submitting ? "Menyimpan..." : "Konfirmasi Penerimaan" }}
      </button>
    </form>
  </section>
</template>
