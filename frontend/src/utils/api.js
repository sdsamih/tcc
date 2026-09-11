const API_BASE = "http://127.0.0.1:8000";

export async function apiRequest(url, options = {}) {
  const token = localStorage.getItem("token");
  
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token inválido ou expirado - fazer logout
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }

  if (response.status === 403) {
    // Acesso negado - redirecionar para home
    window.location.href = "/";
    throw new Error("Acesso negado");
  }

  return response;
}

export async function apiGet(url) {
  const response = await apiRequest(url, { method: "GET" });
  return response.json();
}

export async function apiPost(url, data) {
  const response = await apiRequest(url, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function apiPut(url, data) {
  const response = await apiRequest(url, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function apiDelete(url) {
  const response = await apiRequest(url, { method: "DELETE" });
  return response.json();
}