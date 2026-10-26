<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { listProducts, createProduct } from "@/api/client.js";
import { useAuth } from "@/composables/useAuth.js";
import { usePagedList } from "@/composables/usePagedList.js";
import { fieldErrors } from "@/utils/errors.js";
import { formatDateTime } from "@/utils/format.js";
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
      <h1 class="text-xl font-semibold">Produk</h1>
      <button
        v-if="isSupervisor && !showForm"
        type="button"
        class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        @click="openForm"
      >
        Tambah Produk
      </button>
    </div>

    <p
      v-if="successMessage"
      class="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700"
    >
      {{ successMessage }}
    </p>

    <form
      v-if="showForm"
      class="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      @submit.prevent="handleCreate"
    >
      <h2 class="font-medium">Tambah Produk</h2>
      <p
        v-if="formMessage"
        role="alert"
        class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ formMessage }}
      </p>
      <div class="grid gap-3 sm:grid-cols-3">
        <label class="block space-y-1">
          <span class="text-sm font-medium">SKU</span>
          <input
            v-model="form.sku"
            required
            placeholder="FZ-CHK-001"
            class="w-full rounded-md border border-slate-300 px-3 py-2 uppercase"
          />
          <span v-if="formErrors.sku" class="text-sm text-red-600">{{
            formErrors.sku
          }}</span>
        </label>
        <label class="block space-y-1">
          <span class="text-sm font-medium">Nama</span>
          <input
            v-model="form.name"
            required
            class="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <span v-if="formErrors.name" class="text-sm text-red-600">{{
            formErrors.name
          }}</span>
        </label>
        <label class="block space-y-1">
          <span class="text-sm font-medium">Satuan</span>
          <input
            v-model="form.unit"
            required
            placeholder="KARTON"
            class="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <span v-if="formErrors.unit" class="text-sm text-red-600">{{
            formErrors.unit
          }}</span>
        </label>
      </div>
      <div class="flex gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {{ saving ? "Menyimpan..." : "Simpan" }}
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

    <input
      v-model="search"
      type="search"
      placeholder="Cari SKU atau nama produk..."
      class="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2"
    />

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
            <th class="px-4 py-2 font-medium">Satuan</th>
            <th class="px-4 py-2 font-medium">Dibuat</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="product in rows"
            :key="product.id"
            class="border-t border-slate-100"
          >
            <td class="px-4 py-2 font-mono">{{ product.sku }}</td>
            <td class="px-4 py-2">{{ product.name }}</td>
            <td class="px-4 py-2">{{ product.unit }}</td>
            <td class="px-4 py-2 text-slate-500">
              {{ formatDateTime(product.created_at) }}
            </td>
          </tr>
          <tr v-if="!loading && rows.length === 0">
            <td colspan="4" class="px-4 py-6 text-center text-slate-500">
              Tidak ada produk.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginationBar :pagination="pagination" @change="load" />
  </div>
</template>
