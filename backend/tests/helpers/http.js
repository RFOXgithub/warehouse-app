export async function callRoute(
  handler,
  { method = "GET", path = "/", token, body, headers = {}, params = {} } = {},
) {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const textParams = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  );
  const response = await handler(new Request(`http://test${path}`, init), {
    params: Promise.resolve(textParams),
  });

  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null,
  };
}
