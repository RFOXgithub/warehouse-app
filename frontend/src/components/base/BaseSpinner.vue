<script setup>
import { computed } from "vue";

const props = defineProps({
  size: {
    type: String,
    default: "md",
    validator: (value) => ["sm", "md"].includes(value),
  },
  label: { type: String, default: "" },
});

const ORBIT_CELLS = [0, 1, 2, 7, null, 3, 6, 5, 4];
const ORBIT_STEPS = 8;
const STEP_MS = 108;

const SIZE_STYLES = {
  sm: { "--cell": "4px", "--gap": "2px" },
  md: { "--cell": "8px", "--gap": "4px" },
};

const rootStyle = computed(() => ({
  ...SIZE_STYLES[props.size],
  "--cycle": `${ORBIT_STEPS * STEP_MS}ms`,
}));

const cellStyle = (order) =>
  order === null ? undefined : { animationDelay: `${order * STEP_MS}ms` };
</script>

<template>
  <span role="status" class="inline-flex items-center gap-2" :style="rootStyle">
    <span class="lattice grid shrink-0" aria-hidden="true">
      <span
        v-for="(order, index) in ORBIT_CELLS"
        :key="index"
        :class="['cell rounded-full bg-current', order === null ? 'cell-idle' : 'cell-lit']"
        :style="cellStyle(order)"
      />
    </span>
    <span v-if="label" class="text-sm font-medium">{{ label }}</span>
    <span v-else class="sr-only">Memuat</span>
  </span>
</template>

<style scoped>
.lattice {
  grid-template-columns: repeat(3, var(--cell));
  gap: var(--gap);
}

.cell {
  width: var(--cell);
  height: var(--cell);
  opacity: 0.15;
}

.cell-idle {
  opacity: 0.07;
}

.cell-lit {
  animation: lattice-on var(--cycle) cubic-bezier(0.77, 0, 0.175, 1) infinite;
}

@keyframes lattice-on {
  0%,
  100% {
    opacity: 0.15;
  }
  18%,
  42% {
    opacity: 1;
  }
  62% {
    opacity: 0.15;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cell-lit {
    animation-delay: 0ms !important;
    animation-duration: 1400ms;
  }
}
</style>
