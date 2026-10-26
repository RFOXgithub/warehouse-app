<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth.js";

const route = useRoute();
const router = useRouter();
const { login } = useAuth();

const username = ref("");
const password = ref("");
const submitting = ref(false);
const errorMessage = ref("");

function safeRedirect(value) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : "/documents";
}

async function handleSubmit() {
  errorMessage.value = "";
  submitting.value = true;
  try {
    await login(username.value, password.value);
    router.replace(safeRedirect(route.query.redirect));
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <form
      class="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      @submit.prevent="handleSubmit"
    >
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Penerimaan Barang</h1>
        <p class="text-sm text-slate-500">Masuk untuk melanjutkan.</p>
      </div>

      <label class="block space-y-1">
        <span class="text-sm font-medium text-slate-700">Username</span>
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          required
          class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
        />
      </label>

      <label class="block space-y-1">
        <span class="text-sm font-medium text-slate-700">Password</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
        />
      </label>

      <p
        v-if="errorMessage"
        role="alert"
        class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {{ submitting ? "Memproses..." : "Masuk" }}
      </button>
    </form>
  </div>
</template>
