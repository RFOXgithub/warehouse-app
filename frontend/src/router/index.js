import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "@/composables/useAuth.js";
import LoginView from "@/views/LoginView.vue";
import DocumentsView from "@/views/DocumentsView.vue";
import DocumentDetailView from "@/views/DocumentDetailView.vue";
import ProductsView from "@/views/ProductsView.vue";
import InventoryView from "@/views/InventoryView.vue";
import TransactionsView from "@/views/TransactionsView.vue";

const routes = [
  {
    path: "/login",
    name: "login",
    component: LoginView,
    meta: { public: true },
  },
  { path: "/documents", name: "documents", component: DocumentsView },
  {
    path: "/documents/:id",
    name: "document-detail",
    component: DocumentDetailView,
    props: true,
  },
  { path: "/products", name: "products", component: ProductsView },
  { path: "/inventory", name: "inventory", component: InventoryView },
  {
    path: "/inventory/transactions",
    name: "transactions",
    component: TransactionsView,
  },
  { path: "/:pathMatch(.*)*", redirect: { name: "documents" } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const { isLoggedIn } = useAuth();
  if (to.meta.public) {
    return isLoggedIn.value ? { name: "documents" } : true;
  }
  if (!isLoggedIn.value) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  return true;
});
