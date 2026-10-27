<script setup>
defineProps({
  name: {
    type: String,
    required: true,
    validator: (value) => ["box", "document", "cube", "archive", "clock"].includes(value),
  },
  size: { type: String, default: "size-5" },
});
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="[size, 'shrink-0']"
    aria-hidden="true"
  >
    <template v-if="name === 'box'">
      <path d="M3.5 7.5 12 3l8.5 4.5-8.5 4.5-8.5-4.5Z" />
      <path d="M3.5 7.5V16L12 20.5 20.5 16V7.5" />
      <path d="M12 12v8.5" />
    </template>
    <template v-else-if="name === 'document'">
      <path d="M7 3.5h7l4 4V20a0.5 0.5 0 0 1-0.5 0.5h-10.5A0.5 0.5 0 0 1 6.5 20V4A0.5 0.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V8h4" />
      <path d="M9 13h6M9 16.5h6" />
    </template>
    <template v-else-if="name === 'cube'">
      <path d="M12 3.5 4.5 7.75v8.5L12 20.5l7.5-4.25v-8.5L12 3.5Z" />
      <path d="M4.5 7.75 12 12m0 0 7.5-4.25M12 12v8.5" />
    </template>
    <template v-else-if="name === 'archive'">
      <rect x="3.5" y="4" width="17" height="4.5" rx="1" />
      <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" />
      <path d="M10 12.5h4" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </template>
  </svg>
</template>
