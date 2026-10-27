<script setup>
defineProps({
  variant: {
    type: String,
    default: "info",
    validator: (value) => ["info", "success", "warning", "error"].includes(value),
  },
  title: { type: String, default: null },
});

const VARIANT_CLASSES = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-800",
};
</script>

<template>
  <div
    :role="variant === 'error' ? 'alert' : 'status'"
    :class="['rounded-xl border p-4 text-sm', VARIANT_CLASSES[variant]]"
  >
    <p v-if="title" class="mb-1 font-semibold">{{ title }}</p>
    <slot />
  </div>
</template>
