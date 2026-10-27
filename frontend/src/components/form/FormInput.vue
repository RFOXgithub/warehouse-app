<script setup>
import { computed, ref } from "vue";
import FormField from "@/components/form/FormField.vue";
import { FIELD_PROPS } from "@/components/form/fieldProps";

defineOptions({ inheritAttrs: false });

const model = defineModel();

const props = defineProps({
  ...FIELD_PROPS,
  type: { type: String, default: "text" },
  size: { type: String, default: "md", validator: (value) => ["md", "lg"].includes(value) },
  ariaInvalid: { type: Boolean, default: false },
  ariaDescribedby: { type: String, default: null },
  suffix: { type: String, default: null },
});

const suffixId = computed(() => `${props.id}-suffix`);
const isPassword = computed(() => props.type === "password");
const isPasswordVisible = ref(false);
const isCapsLockOn = ref(false);

const inputType = computed(() =>
  isPassword.value && isPasswordVisible.value ? "text" : props.type,
);

function updateCapsLock(event) {
  if (!isPassword.value || typeof event.getModifierState !== "function") return;
  isCapsLockOn.value = event.getModifierState("CapsLock");
}

function togglePasswordVisibility() {
  isPasswordVisible.value = !isPasswordVisible.value;
}
</script>

<template>
  <FormField
    :id="id"
    :label="label"
    :error="error"
    :hint="hint"
    :required="required"
    :hide-label="hideLabel"
    :size="size"
  >
    <template #default="{ describedBy, hasError, controlClass }">
      <div class="relative">
        <span
          v-if="$slots.icon"
          class="pointer-events-none absolute top-1/2 left-4 flex -translate-y-1/2 items-center text-signal-sky"
          aria-hidden="true"
        >
          <slot name="icon" />
        </span>
        <input
          :id="id"
          v-model="model"
          v-bind="$attrs"
          :type="inputType"
          :aria-required="required"
          :aria-invalid="hasError || ariaInvalid"
          :aria-describedby="
            [describedBy, ariaDescribedby, suffix && suffixId].filter(Boolean).join(' ') ||
            undefined
          "
          :class="[
            controlClass,
            $slots.icon && 'pl-12!',
            isPassword && (isCapsLockOn ? 'pr-24! sm:pr-40!' : 'pr-14!'),
            suffix && 'pr-16!',
          ]"
          @keydown="updateCapsLock"
          @keyup="updateCapsLock"
          @blur="isCapsLockOn = false"
        />
        <span
          v-if="suffix"
          :id="suffixId"
          class="pointer-events-none absolute top-1/2 right-4 flex -translate-y-1/2 items-center text-sm font-medium text-gray-600"
        >
          {{ suffix }}
        </span>
        <template v-if="isPassword">
          <span
            v-if="isCapsLockOn"
            class="pointer-events-none absolute top-1/2 right-14 flex h-7 -translate-y-1/2 items-center gap-1 rounded-md bg-amber-100 px-2 text-xs font-semibold text-amber-900"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.25"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-3.5"
            >
              <path d="m12 4-7 7h4v5h6v-5h4l-7-7Z" />
              <path d="M9 20h6" />
            </svg>
            <span class="max-sm:hidden">Caps Lock</span>
          </span>
          <span class="sr-only" aria-live="polite">{{
            isCapsLockOn ? "Caps Lock aktif" : ""
          }}</span>
        </template>
        <button
          v-if="isPassword"
          type="button"
          :aria-pressed="isPasswordVisible"
          :aria-controls="id"
          class="focus-ring absolute top-1/2 right-1.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          @click="togglePasswordVisibility"
        >
          <span class="sr-only">Tampilkan password</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-5"
            aria-hidden="true"
          >
            <template v-if="isPasswordVisible">
              <path d="M10.7 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.2 3.1" />
              <path d="M6.6 6.6C3.6 8.6 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              <path d="m2 2 20 20" />
            </template>
            <template v-else>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </template>
          </svg>
        </button>
      </div>
    </template>
  </FormField>
</template>
