<script setup>
defineProps({ id: { type: String, required: true } });
</script>

<template>
  <h1 class="text-xl font-semibold">Detail Dokumen {{ id }}</h1>
  <p class="mt-2 text-sm text-slate-500">Halaman ini sedang dibuat.</p>
</template>
