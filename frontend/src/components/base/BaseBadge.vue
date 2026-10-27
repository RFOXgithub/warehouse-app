<script setup>
defineProps({
  variant: {
    type: String,
    default: "neutral",
    validator: (value) => ["neutral", "info", "warning", "success", "danger"].includes(value),
  },
  label: { type: String, required: true },
});

const VARIANT_CLASSES = {
  neutral: "bg-gray-100 text-gray-700",
  info: "bg-sky-50 text-sky-700",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-green-50 text-green-700",
  danger: "bg-red-50 text-red-700",
};

const DOT_CLASSES = {
  neutral: "bg-gray-400",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  success: "bg-green-500",
  danger: "bg-red-500",
};
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
      VARIANT_CLASSES[variant],
    ]"
  >
    <span :class="['size-1.5 rounded-full', DOT_CLASSES[variant]]" aria-hidden="true" />
    {{ label }}
  </span>
</template>
