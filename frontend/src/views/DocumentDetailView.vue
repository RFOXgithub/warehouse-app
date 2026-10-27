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
import BaseButton from "@/components/base/BaseButton.vue";
import BaseAlert from "@/components/base/BaseAlert.vue";

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
const canComplete = computed(() => isSupervisor.value && doc.value?.status === "IN_PROGRESS");

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
    actionDetails.value = error.details.map((detail) => detail.message).filter(Boolean);
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
    await updateReceivingItem(props.id, item.id, { expected_qty: Number(editQty.value) });
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
  if (!window.confirm("Ajukan dokumen? Setelah diajukan, item tidak bisa diubah lagi.")) return;
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
    const { data } = await cancelReceivingDocument(props.id, cancelReason.value);
    doc.value = data;
  }, "Dokumen dibatalkan.");
  if (ok) {
    showCancelForm.value = false;
    cancelReason.value = "";
  }
}

const canReceive = computed(() => ["OPEN", "IN_PROGRESS"].includes(doc.value?.status));

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
  <div class="space-y-5">
    <RouterLink
      :to="{ name: 'documents' }"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-ledger-blue hover:underline"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
        <path d="m15 6-6 6 6 6" />
      </svg>
      Kembali ke daftar dokumen
    </RouterLink>

    <p v-if="loading" class="text-gray-500">Memuat dokumen...</p>
    <BaseAlert v-else-if="loadError" variant="error">{{ loadError }}</BaseAlert>

    <template v-else-if="doc">
      <div class="rounded-2xl border border-ledger-tint/70 bg-ledger-wash p-4 sm:rounded-3xl sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="flex flex-wrap items-center gap-3 text-xl font-bold text-gray-900">
              <span class="font-mono">{{ doc.doc_number }}</span>
              <StatusBadge :status="doc.status" />
            </h1>
            <p class="mt-1 text-gray-600">
              {{ doc.supplier_name }} · rencana datang {{ formatDate(doc.expected_date) }}
            </p>
            <p v-if="doc.notes" class="mt-1 text-sm text-gray-500">Catatan: {{ doc.notes }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <BaseButton v-if="isDraft" variant="primary" :disabled="busy" @click="handleSubmit">
              Ajukan
            </BaseButton>
            <BaseButton
              v-if="canComplete"
              variant="primary"
              class="bg-green-700! hover:bg-green-600!"
              :disabled="busy"
              @click="handleComplete"
            >
              Tandai Selesai
            </BaseButton>
            <BaseButton
              v-if="canCancel && !showCancelForm"
              variant="secondary"
              class="border-red-300! text-red-700! hover:bg-red-50!"
              :disabled="busy"
              @click="showCancelForm = true"
            >
              Batalkan Dokumen
            </BaseButton>
          </div>
        </div>

        <dl class="mt-4 grid gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-2">
          <div>
            <dt class="inline">Dibuat:</dt>
            <dd class="inline">&nbsp;{{ doc.created_by.full_name }}, {{ formatDateTime(doc.created_at) }}</dd>
          </div>
          <div v-if="doc.submitted_by">
            <dt class="inline">Diajukan:</dt>
            <dd class="inline">&nbsp;{{ doc.submitted_by.full_name }}, {{ formatDateTime(doc.submitted_at) }}</dd>
          </div>
          <div v-if="doc.completed_by">
            <dt class="inline">Diselesaikan:</dt>
            <dd class="inline">&nbsp;{{ doc.completed_by.full_name }}, {{ formatDateTime(doc.completed_at) }}</dd>
          </div>
          <div v-if="doc.cancelled_by">
            <dt class="inline">Dibatalkan:</dt>
            <dd class="inline">&nbsp;{{ doc.cancelled_by.full_name }}, {{ formatDateTime(doc.cancelled_at) }}</dd>
          </div>
        </dl>

        <BaseAlert v-if="doc.cancel_reason" variant="error" class="mt-3">
          Alasan pembatalan: {{ doc.cancel_reason }}
        </BaseAlert>

        <form
          v-if="showCancelForm"
          class="mt-4 space-y-2 rounded-2xl border border-red-200 bg-white p-5"
          @submit.prevent="handleCancel"
        >
          <label class="block space-y-1">
            <span class="text-sm font-medium text-gray-700">Alasan pembatalan</span>
            <textarea
              v-model="cancelReason"
              required
              maxlength="500"
              rows="2"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
            />
          </label>
          <div class="flex gap-2">
            <BaseButton type="submit" variant="danger" :disabled="busy">Batalkan Dokumen</BaseButton>
            <BaseButton type="button" variant="secondary" @click="showCancelForm = false">Kembali</BaseButton>
          </div>
        </form>

        <BaseAlert v-if="actionError" variant="error" class="mt-4">
          <p>{{ actionError }}</p>
          <ul v-if="actionDetails.length" class="mt-1 list-disc pl-5">
            <li v-for="message in actionDetails" :key="message">{{ message }}</li>
          </ul>
        </BaseAlert>
        <BaseAlert v-if="actionSuccess" variant="success" class="mt-4">{{ actionSuccess }}</BaseAlert>

        <section class="mt-5 space-y-3">
          <h2 class="font-semibold text-gray-900">Item</h2>
          <div class="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table class="w-full text-left text-sm">
              <thead class="text-gray-500">
                <tr class="border-b border-gray-100">
                  <th class="px-5 py-3 font-medium">SKU</th>
                  <th class="px-5 py-3 font-medium">Produk</th>
                  <th class="px-5 py-3 font-medium">Diharapkan</th>
                  <th class="px-5 py-3 font-medium">Diterima</th>
                  <th class="px-5 py-3 font-medium">Sisa</th>
                  <th v-if="isDraft" class="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in doc.items" :key="item.id" class="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td class="px-5 py-4 font-mono font-medium whitespace-nowrap text-gray-900">{{ item.sku }}</td>
                  <td class="px-5 py-4 text-gray-700">{{ item.product_name }}</td>
                  <td class="px-5 py-4 tabular-nums whitespace-nowrap text-gray-700">
                    <input
                      v-if="editingItemId === item.id"
                      v-model="editQty"
                      type="number"
                      min="1"
                      class="w-24 rounded-lg border border-gray-300 px-2 py-1 focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
                    />
                    <template v-else>{{ formatNumber(item.expected_qty) }} {{ item.unit }}</template>
                  </td>
                  <td class="px-5 py-4 tabular-nums text-gray-700">{{ formatNumber(item.received_qty) }}</td>
                  <td class="px-5 py-4 tabular-nums text-gray-700">{{ formatNumber(item.remaining_qty) }}</td>
                  <td v-if="isDraft" class="px-5 py-4 text-right whitespace-nowrap">
                    <template v-if="editingItemId === item.id">
                      <button type="button" :disabled="busy" class="font-medium text-ledger-blue hover:underline disabled:opacity-50" @click="handleSaveItem(item)">
                        Simpan
                      </button>
                      <button type="button" class="ml-3 font-medium text-gray-500 hover:underline" @click="editingItemId = null">
                        Batal
                      </button>
                    </template>
                    <template v-else>
                      <button type="button" class="font-medium text-ledger-blue hover:underline" @click="startEdit(item)">Ubah</button>
                      <button type="button" :disabled="busy" class="ml-3 font-medium text-red-600 hover:underline disabled:opacity-50" @click="handleDeleteItem(item)">
                        Hapus
                      </button>
                    </template>
                  </td>
                </tr>
                <tr v-if="doc.items.length === 0">
                  <td :colspan="isDraft ? 6 : 5" class="px-5 py-10 text-center text-gray-400">
                    Belum ada item. Tambahkan minimal 1 item sebelum mengajukan dokumen.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <form
            v-if="isDraft"
            class="flex flex-wrap items-start gap-3 rounded-2xl border border-gray-100 bg-white p-5"
            @submit.prevent="handleAddItem"
          >
            <label class="flex min-w-60 flex-1 flex-col gap-1 text-sm">
              <span class="font-medium text-gray-700">Produk</span>
              <select
                v-model="newItem.product_id"
                required
                class="rounded-lg border border-gray-300 px-3 py-2 focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
              >
                <option value="" disabled>Pilih produk</option>
                <option v-for="product in availableProducts" :key="product.id" :value="product.id">
                  {{ product.sku }} · {{ product.name }}
                </option>
              </select>
              <span v-if="newItemErrors.product_id" class="text-red-600">{{ newItemErrors.product_id }}</span>
            </label>
            <label class="flex w-36 flex-col gap-1 text-sm">
              <span class="font-medium text-gray-700">Jumlah diharapkan</span>
              <input
                v-model="newItem.expected_qty"
                type="number"
                min="1"
                required
                class="rounded-lg border border-gray-300 px-3 py-2 focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
              />
              <span v-if="newItemErrors.expected_qty" class="text-red-600">{{ newItemErrors.expected_qty }}</span>
            </label>
            <BaseButton type="submit" variant="primary" class="mt-6" :disabled="busy">Tambah Item</BaseButton>
          </form>
        </section>

        <ReceiptForm
          v-if="canReceive"
          :document-id="doc.id"
          :items="doc.items"
          @received="handleReceived"
          @refresh="loadDocument"
        />

        <section class="mt-5 space-y-3">
          <h2 class="font-semibold text-gray-900">Riwayat Penerimaan</h2>
          <p v-if="doc.receipts.length === 0" class="text-sm text-gray-500">Belum ada barang yang diterima.</p>
          <div
            v-for="receipt in doc.receipts"
            :key="receipt.id"
            class="rounded-2xl border border-gray-100 bg-white p-5 text-sm"
          >
            <p class="font-semibold text-gray-900">
              <span class="font-mono">{{ receipt.receipt_number }}</span>
              <span class="font-normal text-gray-500">
                · {{ receipt.received_by.full_name }}, {{ formatDateTime(receipt.received_at) }}
              </span>
            </p>
            <p v-if="receipt.notes" class="text-gray-500">Catatan: {{ receipt.notes }}</p>
            <ul class="mt-2 space-y-0.5 text-gray-700">
              <li v-for="line in receipt.lines" :key="line.transaction_id">
                <span class="font-mono">{{ line.sku }}</span>
                {{ line.product_name }}:
                <span class="tabular-nums">+{{ formatNumber(line.quantity) }}</span>
                <span class="text-gray-500">(stok jadi {{ formatNumber(line.balance_after) }})</span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
