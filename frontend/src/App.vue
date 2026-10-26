<script setup>
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth.js";

const route = useRoute();
const router = useRouter();
const { user, logout } = useAuth();

const links = [
  { to: "/documents", label: "Dokumen Penerimaan" },
  { to: "/products", label: "Produk" },
  { to: "/inventory", label: "Stok", exact: true },
  { to: "/inventory/transactions", label: "Riwayat Stok" },
];

const roleLabels = { OPERATOR: "Operator", SUPERVISOR: "Supervisor" };

function isActive(link) {
  return link.exact ? route.path === link.to : route.path.startsWith(link.to);
}

function handleLogout() {
  logout();
  router.push({ name: "login" });
}
</script>

<template>
  <RouterView v-if="route.meta.public" />

  <div v-else class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div
        class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
      >
        <span class="font-semibold">Penerimaan Barang</span>

        <nav class="flex flex-wrap gap-1">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded-md px-3 py-1.5 text-sm"
            :class="
              isActive(link)
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            "
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-3 text-sm">
          <span>
            {{ user?.full_name }}
            <span class="text-slate-400">· {{ roleLabels[user?.role] }}</span>
          </span>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
            @click="handleLogout"
          >
            Keluar
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
