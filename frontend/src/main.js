import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router/index.js";
import { onUnauthorized } from "./api/client.js";
import { useAuth } from "./composables/useAuth.js";
import "./style.css";

onUnauthorized(() => {
  useAuth().logout();
  router.push({
    name: "login",
    query: { redirect: router.currentRoute.value.fullPath },
  });
});

createApp(App).use(router).mount("#app");
