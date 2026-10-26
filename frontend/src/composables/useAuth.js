import { computed, ref } from "vue";
import * as api from "@/api/client.js";

const SESSION_KEY = "warehouse.session";

function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (
      session &&
      api.getToken() &&
      new Date(session.expires_at) > new Date()
    ) {
      return session;
    }
  } catch {
    // data rusak atau localStorage tidak tersedia → anggap belum login
  }
  clearStorage();
  return null;
}

function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // diabaikan, lihat api/client.js
  }
}

function clearStorage() {
  api.setToken(null);
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // diabaikan
  }
}

const session = ref(loadSession());

export function useAuth() {
  const user = computed(() => session.value?.user ?? null);
  const isLoggedIn = computed(
    () =>
      session.value !== null && new Date(session.value.expires_at) > new Date(),
  );
  const isSupervisor = computed(() => user.value?.role === "SUPERVISOR");

  async function login(username, password) {
    clearStorage();
    const { data } = await api.login(username, password);
    api.setToken(data.token);
    const newSession = { user: data.user, expires_at: data.expires_at };
    saveSession(newSession);
    session.value = newSession;
  }

  function logout() {
    clearStorage();
    session.value = null;
  }

  return { user, isLoggedIn, isSupervisor, login, logout };
}
