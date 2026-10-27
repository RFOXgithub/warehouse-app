<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import BaseButton from "@/components/base/BaseButton.vue";
import BaseAlert from "@/components/base/BaseAlert.vue";
import BaseErrorIcon from "@/components/base/BaseErrorIcon.vue";
import FormInput from "@/components/form/FormInput.vue";
import { useAuth } from "@/composables/useAuth.js";

const route = useRoute();
const router = useRouter();
const { login } = useAuth();

const username = ref("");
const password = ref("");
const submitting = ref(false);
const errorMessage = ref("");

function safeRedirect(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/documents";
}

async function handleSubmit() {
  if (submitting.value) return;
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

onMounted(() => {
  if (window.matchMedia("(pointer: fine)").matches) document.getElementById("username")?.focus();
});
</script>

<template>
  <form class="space-y-5 pointer-coarse:space-y-6" novalidate @submit.prevent="handleSubmit">
    <FormInput
      id="username"
      v-model="username"
      label="Username"
      size="lg"
      type="text"
      name="username"
      placeholder="Masukkan username Anda"
      autocomplete="username"
      required
      :aria-invalid="Boolean(errorMessage)"
      :aria-describedby="errorMessage ? 'login-error' : null"
    >
      <template #icon>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-5"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      </template>
    </FormInput>

    <FormInput
      id="password"
      v-model="password"
      label="Password"
      size="lg"
      type="password"
      name="password"
      placeholder="Masukkan password"
      autocomplete="current-password"
      required
      :aria-invalid="Boolean(errorMessage)"
      :aria-describedby="errorMessage ? 'login-error' : null"
    >
      <template #icon>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-5"
        >
          <path d="M5 13a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3.6a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V13Z" />
          <path d="M16.1 6.5a4.1 4.1 0 0 0-8.2 0V10" />
          <circle cx="12" cy="14.9" r="1.2" />
          <path d="M12 16.1V18" />
        </svg>
      </template>
    </FormInput>

    <BaseButton
      type="submit"
      variant="primary"
      size="lg"
      :is-loading="submitting"
      class="w-full justify-center shadow-md"
    >
      <svg
        v-if="!submitting"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-5"
        aria-hidden="true"
      >
        <path d="M3 12h11" />
        <path d="m11 8.5 3.5 3.5-3.5 3.5" />
        <path d="M6 18.2A9 9 0 1 0 6 5.8" />
      </svg>
      <template v-if="submitting">Memeriksa akun…</template>
      <template v-else>Masuk</template>
    </BaseButton>

    <BaseAlert v-if="errorMessage" id="login-error" variant="error">
      <div class="flex gap-2.5">
        <BaseErrorIcon />
        <p>{{ errorMessage }}</p>
      </div>
    </BaseAlert>
  </form>
</template>
