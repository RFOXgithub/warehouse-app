<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  getReceivingDocument,
  listProducts,
  addReceivingItem,
  updateReceivingItem,
  deleteReceivingItem,
  submitReceivingDocument,
  cancelReceivingDocument,
  completeReceivingDocument,
} from "@/api/client.js";
import { useAuth } from "@/composables/useAuth.js";
import { fieldErrors } from "@/utils/errors.js";
import { formatDate, formatDateTime, formatNumber } from "@/utils/format.js";
import StatusBadge from "@/components/StatusBadge.vue";
import ReceiptForm from "@/components/ReceiptForm.vue";

const props = defineProps({ id: { type: String, required: true } });
const { isSupervisor } = useAuth();

const doc = ref(null);
const loading = ref(true);
const loadError = ref("");

async function loadDocument() {
  loadError.value = "";
  try {
    const { data } = await getReceivingDocument(props.id);
    doc.value = data;
  } catch (error) {
    loadError.value = error.message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadDocument);
watch(
  () => props.id,
  () => {
    loading.value = true;
    doc.value = null;
    loadDocument();
  },
);

const isDraft = computed(() => doc.value?.status === "DRAFT");
const canCancel = computed(
  () => isSupervisor.value && ["DRAFT", "OPEN"].includes(doc.value?.status),
);
const canComplete = computed(
  () => isSupervisor.value && doc.value?.status === "IN_PROGRESS",
);

const actionError = ref("");
const actionDetails = ref([]);
const actionSuccess = ref("");
const busy = ref(false);

async function runAction(action, successMessage) {
  if (busy.value) return false;
  busy.value = true;
  actionError.value = "";
  actionDetails.value = [];
  actionSuccess.value = "";
  try {
    await action();
    actionSuccess.value = successMessage;
    return true;
  } catch (error) {
    actionError.value = error.message;
    actionDetails.value = error.details
      .map((detail) => detail.message)
      .filter(Boolean);
    return false;
  } finally {
    busy.value = false;
  }
}

const products = ref([]);
const newItem = reactive({ product_id: "", expected_qty: "" });
const newItemErrors = ref({});

const availableProducts = computed(() => {
  const used = new Set(doc.value?.items.map((item) => item.product_id));
  return products.value.filter((product) => !used.has(product.id));
});

async function loadProducts() {
  try {
    const { data } = await listProducts({ page_size: 100 });
    products.value = data;
  } catch (error) {
    actionError.value = error.message;
  }
}

watch(isDraft, (draft) => {
  if (draft && products.value.length === 0) loadProducts();
});

async function handleAddItem() {
  newItemErrors.value = {};
  const ok = await runAction(async () => {
    try {
      await addReceivingItem(props.id, {
        product_id: Number(newItem.product_id),
        expected_qty: Number(newItem.expected_qty),
      });
    } catch (error) {
      newItemErrors.value = fieldErrors(error);
      throw error;
    }
    await loadDocument();
  }, "Item ditambahkan.");
  if (ok) Object.assign(newItem, { product_id: "", expected_qty: "" });
}

const editingItemId = ref(null);
const editQty = ref("");

function startEdit(item) {
  editingItemId.value = item.id;
  editQty.value = item.expected_qty;
}

async function handleSaveItem(item) {
  const ok = await runAction(async () => {
    await updateReceivingItem(props.id, item.id, {
      expected_qty: Number(editQty.value),
    });
    await loadDocument();
  }, "Jumlah item diperbarui.");
  if (ok) editingItemId.value = null;
}

async function handleDeleteItem(item) {
  if (!window.confirm(`Hapus ${item.sku} dari dokumen?`)) return;
  await runAction(async () => {
    await deleteReceivingItem(props.id, item.id);
    await loadDocument();
  }, "Item dihapus.");
}

async function handleSubmit() {
  if (
    !window.confirm(
      "Ajukan dokumen? Setelah diajukan, item tidak bisa diubah lagi.",
    )
  )
    return;
  await runAction(async () => {
    const { data } = await submitReceivingDocument(props.id);
    doc.value = data;
  }, "Dokumen diajukan dan siap menerima barang.");
}

async function handleComplete() {
  if (!window.confirm("Tandai dokumen selesai?")) return;
  await runAction(async () => {
    const { data } = await completeReceivingDocument(props.id);
    doc.value = data;
  }, "Dokumen selesai.");
}

const showCancelForm = ref(false);
const cancelReason = ref("");

async function handleCancel() {
  const ok = await runAction(async () => {
    const { data } = await cancelReceivingDocument(
      props.id,
      cancelReason.value,
    );
    doc.value = data;
  }, "Dokumen dibatalkan.");
  if (ok) {
    showCancelForm.value = false;
    cancelReason.value = "";
  }
}

const canReceive = computed(() =>
  ["OPEN", "IN_PROGRESS"].includes(doc.value?.status),
);

async function handleReceived({ receipt, replayed }) {
  await loadDocument();
  actionError.value = "";
  actionDetails.value = [];
  actionSuccess.value = replayed
    ? `Penerimaan ini sudah tercatat sebelumnya sebagai ${receipt.receipt_number}. Stok tidak ditambah lagi.`
    : `Penerimaan ${receipt.receipt_number} tersimpan. Stok sudah diperbarui.`;
}
</script>

<template>
  <div class="space-y-4">
    <RouterLink
      :to="{ name: 'documents' }"
      class="text-sm text-blue-700 hover:underline"
    >
      ← Kembali ke daftar dokumen
    </RouterLink>

    <p v-if="loading" class="text-slate-500">Memuat dokumen...</p>
    <p
      v-else-if="loadError"
      role="alert"
      class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {{ loadError }}
    </p>

    <template v-else-if="doc">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="flex flex-wrap items-center gap-3 text-xl font-semibold">
            <span class="font-mono">{{ doc.doc_number }}</span>
            <StatusBadge :status="doc.status" />
          </h1>
          <p class="mt-1 text-slate-600">
            {{ doc.supplier_name }} · rencana datang
            {{ formatDate(doc.expected_date) }}
          </p>
          <p v-if="doc.notes" class="mt-1 text-sm text-slate-500">
            Catatan: {{ doc.notes }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="isDraft"
            type="button"
            :disabled="busy"
            class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            @click="handleSubmit"
          >
            Ajukan
          </button>
          <button
            v-if="canComplete"
            type="button"
            :disabled="busy"
            class="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
            @click="handleComplete"
          >
            Tandai Selesai
          </button>
          <button
            v-if="canCancel && !showCancelForm"
            type="button"
            :disabled="busy"
            class="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            @click="showCancelForm = true"
          >
            Batalkan Dokumen
          </button>
        </div>
      </div>

      <dl class="grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <dt class="inline">Dibuat:</dt>
          <dd class="inline">
            {{ doc.created_by.full_name }}, {{ formatDateTime(doc.created_at) }}
          </dd>
        </div>
        <div v-if="doc.submitted_by">
          <dt class="inline">Diajukan:</dt>
          <dd class="inline">
            {{ doc.submitted_by.full_name }},
            {{ formatDateTime(doc.submitted_at) }}
          </dd>
        </div>
        <div v-if="doc.completed_by">
          <dt class="inline">Diselesaikan:</dt>
          <dd class="inline">
            {{ doc.completed_by.full_name }},
            {{ formatDateTime(doc.completed_at) }}
          </dd>
        </div>
        <div v-if="doc.cancelled_by">
          <dt class="inline">Dibatalkan:</dt>
          <dd class="inline">
            {{ doc.cancelled_by.full_name }},
            {{ formatDateTime(doc.cancelled_at) }}
          </dd>
        </div>
      </dl>
      <p
        v-if="doc.cancel_reason"
        class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        Alasan pembatalan: {{ doc.cancel_reason }}
      </p>

      <form
        v-if="showCancelForm"
        class="space-y-2 rounded-lg border border-red-200 bg-white p-4"
        @submit.prevent="handleCancel"
      >
        <label class="block space-y-1">
          <span class="text-sm font-medium">Alasan pembatalan</span>
          <textarea
            v-model="cancelReason"
            required
            maxlength="500"
            rows="2"
            class="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <div class="flex gap-2">
          <button
            type="submit"
            :disabled="busy"
            class="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            Batalkan Dokumen
          </button>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            @click="showCancelForm = false"
          >
            Kembali
          </button>
        </div>
      </form>

      <div
        v-if="actionError"
        role="alert"
        class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        <p>{{ actionError }}</p>
        <ul v-if="actionDetails.length" class="mt-1 list-disc pl-5">
          <li v-for="message in actionDetails" :key="message">{{ message }}</li>
        </ul>
      </div>
      <p
        v-if="actionSuccess"
        role="status"
        class="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800"
      >
        {{ actionSuccess }}
      </p>

      <section class="space-y-2">
        <h2 class="font-medium">Item</h2>
        <div
          class="overflow-x-auto rounded-lg border border-slate-200 bg-white"
        >
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="px-4 py-2 font-medium">SKU</th>
                <th class="px-4 py-2 font-medium">Produk</th>
                <th class="px-4 py-2 text-right font-medium">Diharapkan</th>
                <th class="px-4 py-2 text-right font-medium">Diterima</th>
                <th class="px-4 py-2 text-right font-medium">Sisa</th>
                <th v-if="isDraft" class="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in doc.items"
                :key="item.id"
                class="border-t border-slate-100"
              >
                <td class="px-4 py-2 font-mono whitespace-nowrap">
                  {{ item.sku }}
                </td>
                <td class="px-4 py-2">{{ item.product_name }}</td>
                <td class="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                  <input
                    v-if="editingItemId === item.id"
                    v-model="editQty"
                    type="number"
                    min="1"
                    class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right"
                  />
                  <template v-else
                    >{{ formatNumber(item.expected_qty) }}
                    {{ item.unit }}</template
                  >
                </td>
                <td class="px-4 py-2 text-right tabular-nums">
                  {{ formatNumber(item.received_qty) }}
                </td>
                <td class="px-4 py-2 text-right tabular-nums">
                  {{ formatNumber(item.remaining_qty) }}
                </td>
                <td
                  v-if="isDraft"
                  class="px-4 py-2 text-right whitespace-nowrap"
                >
                  <template v-if="editingItemId === item.id">
                    <button
                      type="button"
                      :disabled="busy"
                      class="text-blue-700 hover:underline disabled:opacity-50"
                      @click="handleSaveItem(item)"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      class="ml-3 text-slate-600 hover:underline"
                      @click="editingItemId = null"
                    >
                      Batal
                    </button>
                  </template>
                  <template v-else>
                    <button
                      type="button"
                      class="text-blue-700 hover:underline"
                      @click="startEdit(item)"
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      :disabled="busy"
                      class="ml-3 text-red-700 hover:underline disabled:opacity-50"
                      @click="handleDeleteItem(item)"
                    >
                      Hapus
                    </button>
                  </template>
                </td>
              </tr>
              <tr v-if="doc.items.length === 0">
                <td
                  :colspan="isDraft ? 6 : 5"
                  class="px-4 py-6 text-center text-slate-500"
                >
                  Belum ada item. Tambahkan minimal 1 item sebelum mengajukan
                  dokumen.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <form
          v-if="isDraft"
          class="flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 bg-white p-4"
          @submit.prevent="handleAddItem"
        >
          <label class="flex min-w-60 flex-1 flex-col gap-1 text-sm">
            <span class="font-medium">Produk</span>
            <select
              v-model="newItem.product_id"
              required
              class="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="" disabled>Pilih produk</option>
              <option
                v-for="product in availableProducts"
                :key="product.id"
                :value="product.id"
              >
                {{ product.sku }} · {{ product.name }}
              </option>
            </select>
            <span v-if="newItemErrors.product_id" class="text-red-600">{{
              newItemErrors.product_id
            }}</span>
          </label>
          <label class="flex w-36 flex-col gap-1 text-sm">
            <span class="font-medium">Jumlah diharapkan</span>
            <input
              v-model="newItem.expected_qty"
              type="number"
              min="1"
              required
              class="rounded-md border border-slate-300 px-3 py-2"
            />
            <span v-if="newItemErrors.expected_qty" class="text-red-600">{{
              newItemErrors.expected_qty
            }}</span>
          </label>
          <button
            type="submit"
            :disabled="busy"
            class="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Tambah Item
          </button>
        </form>
      </section>
      <ReceiptForm
        v-if="canReceive"
        :document-id="doc.id"
        :items="doc.items"
        @received="handleReceived"
        @refresh="loadDocument"
      />
      <section class="space-y-2">
        <h2 class="font-medium">Riwayat Penerimaan</h2>
        <p v-if="doc.receipts.length === 0" class="text-sm text-slate-500">
          Belum ada barang yang diterima.
        </p>
        <div
          v-for="receipt in doc.receipts"
          :key="receipt.id"
          class="rounded-lg border border-slate-200 bg-white p-4 text-sm"
        >
          <p class="font-medium">
            <span class="font-mono">{{ receipt.receipt_number }}</span>
            <span class="font-normal text-slate-600">
              · {{ receipt.received_by.full_name }},
              {{ formatDateTime(receipt.received_at) }}
            </span>
          </p>
          <p v-if="receipt.notes" class="text-slate-500">
            Catatan: {{ receipt.notes }}
          </p>
          <ul class="mt-2 space-y-0.5">
            <li v-for="line in receipt.lines" :key="line.transaction_id">
              <span class="font-mono">{{ line.sku }}</span>
              {{ line.product_name }}:
              <span class="tabular-nums"
                >+{{ formatNumber(line.quantity) }}</span
              >
              <span class="text-slate-500"
                >(stok jadi {{ formatNumber(line.balance_after) }})</span
              >
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>
