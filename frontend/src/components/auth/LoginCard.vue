<script setup>
defineProps({
  title: { type: String, default: "Masuk ke" },
  titleAccent: { type: String, default: "Penerimaan Barang" },
  description: {
    type: String,
  },
});
</script>

<template>
  <div
    class="w-full max-w-md rounded-2xl max-lg:[@media(max-height:30rem)]:grid max-lg:[@media(max-height:30rem)]:max-w-2xl max-lg:[@media(max-height:30rem)]:grid-cols-[1fr_1.5fr] max-lg:[@media(max-height:30rem)]:items-center max-lg:[@media(max-height:30rem)]:gap-x-8 max-lg:[@media(max-height:30rem)]:py-4 border border-gray-200 bg-white px-6 pt-[clamp(1rem,3vh,1.5rem)] pb-[clamp(1.5rem,4.5vh,2.5rem)] shadow-lg shadow-gray-900/10 sm:px-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none"
  >
    <img
      src="/tcl-logo-full.png"
      width="228"
      height="54"
      alt="PT. Tirtamas Coldstorindo Logistik"
      class="mx-auto h-auto max-h-[13vh] w-4/5 max-w-56 object-contain [@media(max-height:30rem)]:max-h-10 max-lg:[@media(max-height:30rem)]:col-start-1 max-lg:[@media(max-height:30rem)]:row-start-1 max-lg:[@media(max-height:30rem)]:self-end lg:mx-0 lg:w-auto lg:max-w-60 lg:object-left"
    />
    <h1
      class="mt-6 text-center [@media(max-height:30rem)]:mt-4 max-lg:[@media(max-height:30rem)]:col-start-1 max-lg:[@media(max-height:30rem)]:row-start-2 max-lg:[@media(max-height:30rem)]:self-start text-[clamp(1.375rem,3.2vh,1.625rem)] leading-tight font-bold tracking-[-0.02em] text-balance text-gray-900 lg:mt-[clamp(1.5rem,5vh,2.75rem)] lg:text-left lg:text-[clamp(1.75rem,3.8vh,2.125rem)]"
    >
      {{ title }} <span class="text-ledger-blue">{{ titleAccent }}</span>
    </h1>
    <p
      class="mx-auto mt-2 mb-[clamp(1.25rem,3.5vh,1.75rem)] max-w-xs max-sm:sr-only [@media(max-height:30rem)]:sr-only text-center text-sm text-balance text-gray-600 lg:mx-0 lg:mb-[clamp(1.5rem,4.5vh,2.25rem)] lg:text-left lg:text-base"
    >
      {{ description }}
    </p>
    <div
      class="max-lg:[@media(max-height:30rem)]:col-start-2 max-lg:[@media(max-height:30rem)]:row-span-2 max-lg:[@media(max-height:30rem)]:row-start-1"
    >
      <slot />
    </div>
  </div>
</template>
