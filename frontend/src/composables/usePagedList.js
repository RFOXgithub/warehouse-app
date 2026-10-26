import { ref } from "vue";

export function usePagedList(fetchPage) {
  const rows = ref([]);
  const pagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 0 });
  const loading = ref(false);
  const errorMessage = ref("");

  let latestRequest = 0;

  async function load(page = 1) {
    const requestId = ++latestRequest;
    loading.value = true;
    errorMessage.value = "";
    try {
      const result = await fetchPage(page);
      if (requestId !== latestRequest) return;
      rows.value = result.data;
      pagination.value = result.pagination;
    } catch (error) {
      if (requestId === latestRequest) errorMessage.value = error.message;
    } finally {
      if (requestId === latestRequest) loading.value = false;
    }
  }

  return { rows, pagination, loading, errorMessage, load };
}
