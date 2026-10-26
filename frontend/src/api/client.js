const TOKEN_KEY = "warehouse.token";

export class ApiError extends Error {
  constructor(status, { code, message, details } = {}) {
    super(message ?? "Terjadi kesalahan. Silakan coba lagi.");
    this.name = "ApiError";
    this.status = status;
    this.code = code ?? "UNKNOWN_ERROR";
    this.details = details ?? [];
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // diabaikan: tanpa localStorage, pengguna hanya perlu login ulang setelah refresh
  }
}

let unauthorizedHandler = () => {};
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

async function request(method, path, { body, query, headers = {} } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const token = getToken();
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(0, {
      code: "NETWORK_ERROR",
      message:
        "Tidak dapat terhubung ke server. Periksa koneksi, lalu coba lagi.",
    });
  }

  if (response.status === 204) {
    return { data: null, status: 204, headers: response.headers };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler();
    throw new ApiError(response.status, payload?.error);
  }
  return { ...payload, status: response.status, headers: response.headers };
}

// ===== Auth =====
export const login = (username, password) =>
  request("POST", "/auth/login", { body: { username, password } });
export const getCurrentUser = () => request("GET", "/auth/me");

// ===== Produk =====
export const listProducts = (query) => request("GET", "/products", { query });
export const createProduct = (body) => request("POST", "/products", { body });

// ===== Dokumen penerimaan =====
export const listReceivingDocuments = (query) =>
  request("GET", "/receiving-documents", { query });
export const createReceivingDocument = (body) =>
  request("POST", "/receiving-documents", { body });
export const getReceivingDocument = (id) =>
  request("GET", `/receiving-documents/${id}`);
export const addReceivingItem = (id, body) =>
  request("POST", `/receiving-documents/${id}/items`, { body });
export const updateReceivingItem = (id, itemId, body) =>
  request("PATCH", `/receiving-documents/${id}/items/${itemId}`, { body });
export const deleteReceivingItem = (id, itemId) =>
  request("DELETE", `/receiving-documents/${id}/items/${itemId}`);
export const submitReceivingDocument = (id) =>
  request("POST", `/receiving-documents/${id}/submit`);
export const completeReceivingDocument = (id) =>
  request("POST", `/receiving-documents/${id}/complete`);
export const cancelReceivingDocument = (id, reason) =>
  request("POST", `/receiving-documents/${id}/cancel`, { body: { reason } });

// ===== Penerimaan =====
export const createReceipt = (id, body, idempotencyKey) =>
  request("POST", `/receiving-documents/${id}/receipts`, {
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });

// ===== Stok =====
export const listInventory = (query) => request("GET", "/inventory", { query });
export const listInventoryTransactions = (query) =>
  request("GET", "/inventory/transactions", { query });
