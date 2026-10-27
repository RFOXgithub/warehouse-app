<script setup>
import LoginCard from "@/components/auth/LoginCard.vue";
import LoginForm from "@/components/auth/LoginForm.vue";

const currentYear = new Date().getFullYear();

const HERO_HIDDEN_MEDIA = "(max-width: 63.98rem) and (max-height: 30rem)";
const BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const BRAND_STRIPES = [
  { color: "bg-brand-sky", height: "h-[66dvh]", offset: "left-[calc(100%-31.2dvh)]" },
  { color: "bg-brand-amber", height: "h-[44dvh]", offset: "left-[calc(100%-25.4dvh)]" },
  { color: "bg-brand-silver", height: "h-[28dvh]", offset: "left-[calc(100%-19.6dvh)]" },
];
</script>

<template>
  <main
    class="relative grid min-h-[100dvh] bg-gray-50 font-display lg:h-dvh lg:grid-cols-[minmax(0,1fr)_480px] lg:bg-white xl:grid-cols-[minmax(0,1fr)_560px]"
  >
    <section
      class="relative h-[min(52dvh,max(0rem,calc(100dvh-34rem)))] max-lg:[@media(max-height:30rem)]:hidden lg:h-auto lg:min-h-0"
    >
      <div
        class="absolute inset-0 overflow-hidden bg-sky-950 lg:[clip-path:polygon(0_0,100%_0,calc(100%-32dvh)_100%,0_100%)]"
      >
        <picture>
          <source :media="HERO_HIDDEN_MEDIA" :srcset="BLANK_IMAGE" />
          <img
            src="/login-hero.jpg"
            alt=""
            width="1500"
            height="2000"
            fetchpriority="high"
            decoding="async"
            class="absolute inset-0 h-full w-full object-cover object-[50%_30%] motion-safe:transition-transform motion-safe:duration-[1400ms] motion-safe:ease-out motion-safe:starting:scale-105 lg:object-left"
          />
        </picture>
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-sky-950/70 to-transparent lg:h-3/5 lg:from-sky-950/95 lg:via-sky-950/55"
          aria-hidden="true"
        />
      </div>

      <div class="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
        <span
          v-for="stripe in BRAND_STRIPES"
          :key="stripe.color"
          :class="[
            'absolute bottom-0 w-[4.6dvh] origin-bottom -skew-x-[17.74deg] rounded-t-full motion-safe:transition-transform motion-safe:duration-[900ms] motion-safe:ease-fluid motion-safe:starting:translate-y-full',
            stripe.color,
            stripe.height,
            stripe.offset,
          ]"
        />
      </div>

      <div
        class="absolute bottom-0 left-0 hidden px-10 pb-12 lg:block lg:max-w-[calc(100%-34dvh)] xl:px-14 xl:pb-16"
      >
        <div
          class="motion-safe:transition-[opacity,translate,filter] motion-safe:delay-150 motion-safe:duration-[1000ms] motion-safe:ease-fluid motion-safe:starting:translate-y-6 motion-safe:starting:blur-sm starting:opacity-0"
        >
          <p
            class="max-w-xl text-[clamp(1.75rem,2.6vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.03em] text-balance text-white [text-shadow:0_2px_16px_rgb(8_47_73/0.6)]"
          >
            Penerimaan barang gudang di satu tempat,
            <span class="font-normal text-sky-100">setiap perubahan tercatat.</span>
          </p>
          <div class="mt-6 flex gap-1" aria-hidden="true">
            <span class="h-1.5 w-12 rounded-full bg-brand-sky" />
            <span class="h-1.5 w-12 rounded-full bg-brand-amber" />
            <span class="h-1.5 w-12 rounded-full bg-brand-silver" />
          </div>
        </div>
      </div>
    </section>

    <section
      class="relative z-10 -mt-[min(6rem,max(0rem,calc(50dvh-17rem)))] flex flex-col px-4 pb-6 max-lg:[@media(max-height:30rem)]:mt-0 max-lg:[@media(max-height:30rem)]:pt-6 sm:px-10 lg:mt-0 lg:px-12 lg:py-[clamp(1rem,3vh,3rem)] xl:px-16 lg:overflow-y-auto lg:[scrollbar-gutter:stable]"
    >
      <div
        class="flex justify-center motion-safe:transition-[opacity,translate] motion-safe:duration-500 motion-safe:ease-out motion-safe:starting:translate-y-2 starting:opacity-0 lg:mt-[max(0rem,calc(50dvh-19rem))] lg:mb-auto"
      >
        <LoginCard>
          <LoginForm />
        </LoginCard>
      </div>

      <p
        class="mx-auto mt-4 w-full max-w-md text-center text-xs font-medium text-gray-500 lg:mt-0 lg:pt-[clamp(1rem,3vh,2.5rem)] lg:text-right"
      >
        &copy; {{ currentYear }} PT. Tirtamas Coldstorindo Logistik
      </p>
    </section>
  </main>
</template>
