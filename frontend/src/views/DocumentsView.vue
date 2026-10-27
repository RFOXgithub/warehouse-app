<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { listReceivingDocuments, createReceivingDocument } from "@/api/client.js";
import { usePagedList } from "@/composables/usePagedList.js";
import { fieldErrors } from "@/utils/errors.js";
import { formatDate, formatNumber } from "@/utils/format.js";
import AppPageTabs from "@/components/layout/AppPageTabs.vue";
import AppNavIcon from "@/components/layout/AppNavIcon.vue";
import BaseButton from "@/components/base/BaseButton.vue";
import BaseAlert from "@/components/base/BaseAlert.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import StatusBadge from "@/components/StatusBadge.vue";

const router = useRouter();

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Menunggu barang" },
  { value: "IN_PROGRESS", label: "Sedang diterima" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "CANCELLED", label: "Dibatalkan" },
];
const status = ref("");
const search = ref("");

const { rows, pagination, loading, errorMessage, load } = usePagedList((page) =>
  listReceivingDocuments({ page, status: status.value }),
);

watch(status, () => load(1));
onMounted(() => load(1));

const visibleRows = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return rows.value;
  return rows.value.filter((doc) =>
    [doc.doc_number, doc.supplier_name, formatDate(doc.expected_date)]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
});

const showForm = ref(false);
const form = reactive({ supplier_name: "", expected_date: "", notes: "" });
const formErrors = ref({});
const formMessage = ref("");
const saving = ref(false);

function openForm() {
  Object.assign(form, { supplier_name: "", expected_date: "", notes: "" });
  formErrors.value = {};
  formMessage.value = "";
  showForm.value = true;
}

async function handleCreate() {
  saving.value = true;
  formErrors.value = {};
  formMessage.value = "";
  try {
    const { data } = await createReceivingDocument({ ...form });
    router.push({ name: "document-detail", params: { id: data.id } });
  } catch (error) {
    formErrors.value = fieldErrors(error);
    formMessage.value = Object.keys(formErrors.value).length ? "" : error.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <AppPageTabs />

    <div class="rounded-2xl border border-ledger-tint/70 bg-ledger-wash p-4 sm:rounded-3xl sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-ledger-blue shadow-sm">
            <AppNavIcon name="document" />
          </span>
          <div>
            <h2 class="text-lg font-bold text-gray-900">Dokumen Penerimaan</h2>
            <p class="text-sm text-gray-500">Kelola dan pantau seluruh dokumen penerimaan barang.</p>
          </div>
        </div>
        <BaseButton v-if="!showForm" variant="primary" @click="openForm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="size-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Buat Dokumen
        </BaseButton>
      </div>

      <form
        v-if="showForm"
        class="mt-5 space-y-3 rounded-2xl border border-gray-100 bg-white p-5"
        @submit.prevent="handleCreate"
      >
        <h3 class="font-semibold text-gray-900">Buat Dokumen Penerimaan</h3>
        <BaseAlert v-if="formMessage" variant="error">{{ formMessage }}</BaseAlert>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block space-y-1">
            <span class="text-sm font-medium text-gray-700">Supplier</span>
            <input
              v-model="form.supplier_name"
              required
              placeholder="PT Sumber Beku"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
            />
            <span v-if="formErrors.supplier_name" class="text-sm text-red-600">{{ formErrors.supplier_name }}</span>
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium text-gray-700">Tanggal rencana kedatangan</span>
            <input
              v-model="form.expected_date"
              type="date"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
            />
            <span v-if="formErrors.expected_date" class="text-sm text-red-600">{{ formErrors.expected_date }}</span>
          </label>
        </div>
        <label class="block space-y-1">
          <span class="text-sm font-medium text-gray-700">Catatan (opsional)</span>
          <textarea
            v-model="form.notes"
            rows="2"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
          />
          <span v-if="formErrors.notes" class="text-sm text-red-600">{{ formErrors.notes }}</span>
        </label>
        <div class="flex gap-2">
          <BaseButton type="submit" variant="primary" :is-loading="saving">
            {{ saving ? "Menyimpan..." : "Buat & lanjut tambah item" }}
          </BaseButton>
          <BaseButton type="button" variant="secondary" @click="showForm = false">Batal</BaseButton>
        </div>
      </form>

      <div class="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-ledger-tint/70 bg-white/70 p-3">
        <label class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="size-4 text-gray-400">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          <select v-model="status" class="bg-transparent text-sm font-medium text-gray-700 focus:outline-none">
            <option v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0 text-gray-400">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            v-model="search"
            type="search"
            placeholder="Cari nomor dokumen, supplier, atau tanggal..."
            class="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
          />
        </label>
      </div>

      <BaseAlert v-if="errorMessage" variant="error" class="mt-4">{{ errorMessage }}</BaseAlert>

      <div class="mt-5 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table class="w-full text-left text-sm">
          <thead class="text-gray-500">
            <tr class="border-b border-gray-100">
              <th class="px-5 py-3 font-medium">No. Dokumen</th>
              <th class="px-5 py-3 font-medium">Supplier</th>
              <th class="px-5 py-3 font-medium">Rencana Datang</th>
              <th class="px-5 py-3 font-medium">Status</th>
              <th class="px-5 py-3 font-medium">Item</th>
              <th class="px-5 py-3 font-medium">Diterima / Diharapkan</th>
              <th class="px-5 py-3 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="doc in visibleRows"
              :key="doc.id"
              class="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
            >
              <td class="px-5 py-4">
                <RouterLink
                  :to="{ name: 'document-detail', params: { id: doc.id } }"
                  class="flex items-center gap-2.5 font-semibold text-ledger-blue hover:underline"
                >
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ledger-wash text-ledger-blue">
                    <AppNavIcon name="document" size="size-4" />
                  </span>
                  {{ doc.doc_number }}
                </RouterLink>
              </td>
              <td class="px-5 py-4">
                <p class="font-medium text-gray-900">{{ doc.supplier_name }}</p>
                <p class="text-xs text-gray-400">Supplier</p>
              </td>
              <td class="px-5 py-4 whitespace-nowrap">
                <p class="flex items-center gap-1.5 font-medium text-gray-900">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="size-4 text-gray-400">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                  </svg>
                  {{ formatDate(doc.expected_date) }}
                </p>
                <p class="text-xs text-gray-400">Estimasi</p>
              </td>
              <td class="px-5 py-4"><StatusBadge :status="doc.status" /></td>
              <td class="px-5 py-4">
                <p class="font-medium text-gray-900 tabular-nums">{{ doc.item_count }}</p>
                <p class="text-xs text-gray-400">Total Item</p>
              </td>
              <td class="px-5 py-4 whitespace-nowrap">
                <p class="font-medium text-gray-900 tabular-nums">
                  {{ formatNumber(doc.total_received) }} / {{ formatNumber(doc.total_expected) }}
                </p>
                <p class="text-xs text-gray-400">Diterima</p>
              </td>
              <td class="px-5 py-4 text-right">
                <RouterLink
                  :to="{ name: 'document-detail', params: { id: doc.id } }"
                  class="focus-ring inline-flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Lihat detail dokumen"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" class="size-4.5">
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                  </svg>
                </RouterLink>
              </td>
            </tr>
            <tr v-if="!loading && visibleRows.length === 0">
              <td colspan="7" class="px-5 py-10 text-center text-gray-400">
                Belum ada dokumen.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PaginationBar class="mt-4" :pagination="pagination" @change="load" />
    </div>
  </div>
</template>
