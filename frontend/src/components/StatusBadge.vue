<script setup>
import { computed } from "vue";

const STATUS_STYLES = {
  DRAFT: { label: "Draft", class: "bg-slate-100 text-slate-700" },
  OPEN: { label: "Menunggu barang", class: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: {
    label: "Sedang diterima",
    class: "bg-amber-100 text-amber-800",
  },
  COMPLETED: { label: "Selesai", class: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Dibatalkan", class: "bg-red-100 text-red-700" },
};

const props = defineProps({ status: { type: String, required: true } });
const style = computed(
  () => STATUS_STYLES[props.status] ?? { label: props.status, class: "" },
);
</script>

<template>
  <span
    class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
    :class="style.class"
  >
    {{ style.label }}
  </span>
</template>
