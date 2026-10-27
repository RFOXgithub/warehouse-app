<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import BaseSpinner from "@/components/base/BaseSpinner.vue";

const props = defineProps({
  variant: {
    type: String,
    default: "primary",
    validator: (value) =>
      ["primary", "secondary", "soft", "danger", "ghost", "link"].includes(value),
  },
  size: {
    type: String,
    default: "md",
    validator: (value) => ["sm", "md", "lg"].includes(value),
  },
  type: { type: String, default: "button" },
  to: { type: [String, Object], default: null },
  isLoading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});

const VARIANT_CLASSES = {
  primary: "bg-ledger-blue text-white shadow-sm shadow-sky-900/15 hover:bg-ledger-blue-deep",
  secondary:
    "border border-gray-200 bg-white text-gray-700 shadow-xs hover:border-gray-300 hover:bg-gray-50",
  soft: "bg-ledger-wash text-ledger-blue-deep ring-1 ring-sky-200 ring-inset hover:bg-sky-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-gray-700 hover:bg-gray-100",
  link: "text-gray-500 hover:text-ledger-blue hover:underline",
};

const SIZE_CLASSES = {
  sm: "rounded-md px-2.5 py-1 text-xs max-sm:min-h-11 pointer-coarse:min-h-11",
  md: "rounded-lg px-4 py-2 text-sm max-sm:min-h-11 pointer-coarse:min-h-11",
  lg: "h-14 rounded-xl px-6 text-base",
};

const buttonClass = computed(() => [
  "focus-ring inline-flex items-center gap-2 font-medium",
  props.variant === "link"
    ? "text-sm max-sm:min-h-11 pointer-coarse:min-h-11"
    : SIZE_CLASSES[props.size],
  VARIANT_CLASSES[props.variant],
]);
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="buttonClass">
    <slot />
  </RouterLink>
  <button
    v-else
    :type="type"
    :disabled="disabled || isLoading"
    :aria-busy="isLoading || undefined"
    :class="[
      buttonClass,
      isLoading ? 'cursor-wait' : 'disabled:cursor-not-allowed disabled:opacity-60',
    ]"
  >
    <BaseSpinner v-if="isLoading" size="sm" aria-hidden="true" />
    <slot />
  </button>
</template>
