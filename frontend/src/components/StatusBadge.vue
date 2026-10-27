<script setup>
import { computed } from "vue";
import BaseBadge from "@/components/base/BaseBadge.vue";

const STATUS_STYLES = {
  DRAFT: { label: "Draft", variant: "neutral" },
  OPEN: { label: "Menunggu barang", variant: "info" },
  IN_PROGRESS: { label: "Sedang diterima", variant: "warning" },
  COMPLETED: { label: "Selesai", variant: "success" },
  CANCELLED: { label: "Dibatalkan", variant: "danger" },
};

const props = defineProps({ status: { type: String, required: true } });
const style = computed(() => STATUS_STYLES[props.status] ?? { label: props.status, variant: "neutral" });
</script>

<template>
  <BaseBadge :variant="style.variant" :label="style.label" />
</template>
