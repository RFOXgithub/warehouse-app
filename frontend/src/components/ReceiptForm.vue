<script setup>
import { computed, reactive, ref, watch } from "vue";
import { createReceipt } from "@/api/client.js";
import { newIdempotencyKey } from "@/utils/idempotency.js";
import { formatNumber } from "@/utils/format.js";
import BaseButton from "@/components/base/BaseButton.vue";
import BaseAlert from "@/components/base/BaseAlert.vue";

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
  <section class="mt-5 space-y-3">
    <h2 class="font-semibold text-gray-900">Catat Penerimaan</h2>

    <BaseAlert v-if="openItems.length === 0" variant="info">
      Semua item sudah diterima penuh. Supervisor dapat menandai dokumen selesai.
    </BaseAlert>

    <form
      v-else
      class="space-y-4 rounded-2xl border border-gray-100 bg-white p-5"
      @submit.prevent="handleSubmit"
    >
      <BaseAlert v-if="errorMessage" variant="error">
        <p>{{ errorMessage }}</p>
        <ul v-if="errorDetails.length" class="mt-1 list-disc pl-5">
          <li v-for="message in errorDetails" :key="message">{{ message }}</li>
        </ul>
      </BaseAlert>

      <div class="overflow-x-auto rounded-xl border border-gray-100">
        <table class="w-full text-left text-sm">
          <thead class="text-gray-500">
            <tr class="border-b border-gray-100">
              <th class="px-4 py-3 font-medium">SKU</th>
              <th class="px-4 py-3 font-medium">Produk</th>
              <th class="px-4 py-3 font-medium">Sisa</th>
              <th class="px-4 py-3 font-medium">Terima sekarang</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in openItems"
              :key="item.id"
              class="border-b border-gray-50 align-top last:border-0"
            >
              <td class="px-4 py-3 font-mono font-medium whitespace-nowrap text-gray-900">
                {{ item.sku }}
              </td>
              <td class="px-4 py-3 text-gray-700">{{ item.product_name }}</td>
              <td class="px-4 py-3 tabular-nums whitespace-nowrap text-gray-700">
                {{ formatNumber(item.remaining_qty) }} {{ item.unit }}
              </td>
              <td class="px-4 py-3">
                <input
                  v-model="quantities[item.id]"
                  type="number"
                  min="0"
                  :max="item.remaining_qty"
                  step="1"
                  placeholder="0"
                  :aria-label="`Terima sekarang ${item.sku}`"
                  class="w-28 rounded-lg border px-2 py-1.5 text-right focus:ring-2 focus:outline-none"
                  :class="
                    lineErrors[item.id]
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-signal-sky focus:ring-signal-sky'
                  "
                />
                <p v-if="lineErrors[item.id]" class="mt-1 text-red-600">{{ lineErrors[item.id] }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <label class="block space-y-1">
        <span class="text-sm font-medium text-gray-700">
          Catatan (opsional, misalnya nomor polisi truk)
        </span>
        <input
          v-model="notes"
          maxlength="500"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
        />
      </label>

      <BaseButton type="submit" variant="primary" :is-loading="submitting">
        {{ submitting ? "Menyimpan..." : "Konfirmasi Penerimaan" }}
      </BaseButton>
    </form>
  </section>
</template>
