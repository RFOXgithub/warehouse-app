<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  listReceivingDocuments,
  createReceivingDocument,
} from "@/api/client.js";
import { usePagedList } from "@/composables/usePagedList.js";
import { fieldErrors } from "@/utils/errors.js";
import { formatDate, formatNumber } from "@/utils/format.js";
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

const { rows, pagination, loading, errorMessage, load } = usePagedList((page) =>
  listReceivingDocuments({ page, status: status.value }),
);

watch(status, () => load(1));
onMounted(() => load(1));

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
    formMessage.value = Object.keys(formErrors.value).length
      ? ""
      : error.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Dokumen Penerimaan</h1>
      <button
        v-if="!showForm"
        type="button"
        class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        @click="openForm"
      >
        Buat Dokumen
      </button>
    </div>

    <form
      v-if="showForm"
      class="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      @submit.prevent="handleCreate"
    >
      <h2 class="font-medium">Buat Dokumen Penerimaan</h2>
      <p
        v-if="formMessage"
        role="alert"
        class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ formMessage }}
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block space-y-1">
          <span class="text-sm font-medium">Supplier</span>
          <input
            v-model="form.supplier_name"
            required
            placeholder="PT Sumber Beku"
            class="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <span v-if="formErrors.supplier_name" class="text-sm text-red-600">
            {{ formErrors.supplier_name }}
          </span>
        </label>
        <label class="block space-y-1">
          <span class="text-sm font-medium">Tanggal rencana kedatangan</span>
          <input
            v-model="form.expected_date"
            type="date"
            required
            class="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <span v-if="formErrors.expected_date" class="text-sm text-red-600">
            {{ formErrors.expected_date }}
          </span>
        </label>
      </div>
      <label class="block space-y-1">
        <span class="text-sm font-medium">Catatan (opsional)</span>
        <textarea
          v-model="form.notes"
          rows="2"
          class="w-full rounded-md border border-slate-300 px-3 py-2"
        />
        <span v-if="formErrors.notes" class="text-sm text-red-600">{{
          formErrors.notes
        }}</span>
      </label>
      <div class="flex gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {{ saving ? "Menyimpan..." : "Buat & lanjut tambah item" }}
        </button>
        <button
          type="button"
          class="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
          @click="showForm = false"
        >
          Batal
        </button>
      </div>
    </form>

    <label class="flex max-w-xs flex-col gap-1 text-sm">
      <span class="font-medium">Status</span>
      <select
        v-model="status"
        class="rounded-md border border-slate-300 px-3 py-2"
      >
        <option
          v-for="option in STATUS_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
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
            <th class="px-4 py-2 font-medium">Nomor</th>
            <th class="px-4 py-2 font-medium">Supplier</th>
            <th class="px-4 py-2 font-medium">Rencana datang</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="px-4 py-2 text-right font-medium">Item</th>
            <th class="px-4 py-2 text-right font-medium">
              Diterima / Diharapkan
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="doc in rows"
            :key="doc.id"
            class="border-t border-slate-100 hover:bg-slate-50"
          >
            <td class="px-4 py-2 font-mono whitespace-nowrap">
              <RouterLink
                :to="{ name: 'document-detail', params: { id: doc.id } }"
                class="text-blue-700 hover:underline"
              >
                {{ doc.doc_number }}
              </RouterLink>
            </td>
            <td class="px-4 py-2">{{ doc.supplier_name }}</td>
            <td class="px-4 py-2 whitespace-nowrap">
              {{ formatDate(doc.expected_date) }}
            </td>
            <td class="px-4 py-2"><StatusBadge :status="doc.status" /></td>
            <td class="px-4 py-2 text-right tabular-nums">
              {{ doc.item_count }}
            </td>
            <td class="px-4 py-2 text-right tabular-nums whitespace-nowrap">
              {{ formatNumber(doc.total_received) }} /
              {{ formatNumber(doc.total_expected) }}
            </td>
          </tr>
          <tr v-if="!loading && rows.length === 0">
            <td colspan="6" class="px-4 py-6 text-center text-slate-500">
              Belum ada dokumen.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginationBar :pagination="pagination" @change="load" />
  </div>
</template>
