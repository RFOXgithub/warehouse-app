<script setup>
const STRIPES = [
  { color: "bg-brand-sky", height: "h-40", offset: "left-[calc(100%-5.5rem)]" },
  { color: "bg-brand-amber", height: "h-28", offset: "left-[calc(100%-4.1rem)]" },
  { color: "bg-brand-silver", height: "h-16", offset: "left-[calc(100%-2.7rem)]" },
];
</script>

<template>
  <div
    class="pointer-events-none fixed right-0 bottom-0 z-0 h-40 w-24 overflow-hidden"
    aria-hidden="true"
  >
    <span
      v-for="stripe in STRIPES"
      :key="stripe.color"
      :class="[
        'absolute bottom-0 w-3 origin-bottom -skew-x-[17.74deg] rounded-t-full',
        stripe.color,
        stripe.height,
        stripe.offset,
      ]"
    />
  </div>
</template>
