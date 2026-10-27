<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { listProducts, createProduct } from "@/api/client.js";
import { useAuth } from "@/composables/useAuth.js";
import { usePagedList } from "@/composables/usePagedList.js";
import { fieldErrors } from "@/utils/errors.js";
import { formatDateTime } from "@/utils/format.js";
import AppPageTabs from "@/components/layout/AppPageTabs.vue";
import AppNavIcon from "@/components/layout/AppNavIcon.vue";
import BaseButton from "@/components/base/BaseButton.vue";
import BaseAlert from "@/components/base/BaseAlert.vue";
import PaginationBar from "@/components/PaginationBar.vue";

const { isSupervisor } = useAuth();

const search = ref("");
const { rows, pagination, loading, errorMessage, load } = usePagedList((page) =>
  listProducts({ page, q: search.value.trim() }),
);

let searchTimer;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 300);
});

onMounted(() => load(1));

const showForm = ref(false);
const form = reactive({ sku: "", name: "", unit: "" });
const formErrors = ref({});
const formMessage = ref("");
const saving = ref(false);
const successMessage = ref("");

function openForm() {
  Object.assign(form, { sku: "", name: "", unit: "" });
  formErrors.value = {};
  formMessage.value = "";
  successMessage.value = "";
  showForm.value = true;
}

async function handleCreate() {
  saving.value = true;
  formErrors.value = {};
  formMessage.value = "";
  try {
    const { data } = await createProduct({ ...form });
    showForm.value = false;
    successMessage.value = `Produk ${data.sku} berhasil ditambahkan.`;
    await load(pagination.value.page);
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
            <AppNavIcon name="cube" />
          </span>
          <div>
            <h2 class="text-lg font-bold text-gray-900">Produk</h2>
            <p class="text-sm text-gray-500">Kelola daftar produk dan satuannya.</p>
          </div>
        </div>
        <BaseButton v-if="isSupervisor && !showForm" variant="primary" @click="openForm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="size-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Tambah Produk
        </BaseButton>
      </div>

      <BaseAlert v-if="successMessage" variant="success" class="mt-4">{{ successMessage }}</BaseAlert>

      <form
        v-if="showForm"
        class="mt-5 space-y-3 rounded-2xl border border-gray-100 bg-white p-5"
        @submit.prevent="handleCreate"
      >
        <h3 class="font-semibold text-gray-900">Tambah Produk</h3>
        <BaseAlert v-if="formMessage" variant="error">{{ formMessage }}</BaseAlert>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="block space-y-1">
            <span class="text-sm font-medium text-gray-700">SKU</span>
            <input
              v-model="form.sku"
              required
              placeholder="FZ-CHK-001"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
            />
            <span v-if="formErrors.sku" class="text-sm text-red-600">{{ formErrors.sku }}</span>
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium text-gray-700">Nama</span>
            <input
              v-model="form.name"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
            />
            <span v-if="formErrors.name" class="text-sm text-red-600">{{ formErrors.name }}</span>
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium text-gray-700">Satuan</span>
            <input
              v-model="form.unit"
              required
              placeholder="KARTON"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-signal-sky focus:ring-2 focus:ring-signal-sky focus:outline-none"
            />
            <span v-if="formErrors.unit" class="text-sm text-red-600">{{ formErrors.unit }}</span>
          </label>
        </div>
        <div class="flex gap-2">
          <BaseButton type="submit" variant="primary" :is-loading="saving">
            {{ saving ? "Menyimpan..." : "Simpan" }}
          </BaseButton>
          <BaseButton type="button" variant="secondary" @click="showForm = false">Batal</BaseButton>
        </div>
      </form>

      <div class="mt-5 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 sm:max-w-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0 text-gray-400">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          v-model="search"
          type="search"
          placeholder="Cari SKU atau nama produk..."
          class="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
        />
      </div>

      <BaseAlert v-if="errorMessage" variant="error" class="mt-4">{{ errorMessage }}</BaseAlert>

      <div class="mt-5 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table class="w-full text-left text-sm">
          <thead class="text-gray-500">
            <tr class="border-b border-gray-100">
              <th class="px-5 py-3 font-medium">SKU</th>
              <th class="px-5 py-3 font-medium">Nama</th>
              <th class="px-5 py-3 font-medium">Satuan</th>
              <th class="px-5 py-3 font-medium">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="product in rows"
              :key="product.id"
              class="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
            >
              <td class="px-5 py-4 font-mono font-medium text-gray-900">{{ product.sku }}</td>
              <td class="px-5 py-4 text-gray-700">{{ product.name }}</td>
              <td class="px-5 py-4 text-gray-700">{{ product.unit }}</td>
              <td class="px-5 py-4 text-gray-500">{{ formatDateTime(product.created_at) }}</td>
            </tr>
            <tr v-if="!loading && rows.length === 0">
              <td colspan="4" class="px-5 py-10 text-center text-gray-400">Tidak ada produk.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <PaginationBar class="mt-4" :pagination="pagination" @change="load" />
    </div>
  </div>
</template>
