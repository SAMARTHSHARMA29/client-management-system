// ─── API Fetch Wrapper ────────────────────────────────────────────────────────

const API = {
  base: '/api',

  async request(method, path, body = null) {
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${this.base}${path}`, opts);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (e) {
      showToast(e.message || 'Network error', 'error');
      throw e;
    }
  },

  get:    (path)        => API.request('GET',    path),
  post:   (path, data)  => API.request('POST',   path, data),
  put:    (path, data)  => API.request('PUT',    path, data),
  delete: (path)        => API.request('DELETE', path),

  // Dashboard
  getDashboardStats:        () => API.get('/dashboard/stats'),
  getDashboardRevenue:      () => API.get('/dashboard/revenue'),
  getDashboardActivity:     () => API.get('/dashboard/activity'),
  getClientDistribution:    () => API.get('/dashboard/client-distribution'),

  // Clients
  getClients:    (params = {}) => API.get('/clients?' + new URLSearchParams(params)),
  getClient:     (id)          => API.get(`/clients/${id}`),
  createClient:  (data)        => API.post('/clients', data),
  updateClient:  (id, data)    => API.put(`/clients/${id}`, data),
  deleteClient:  (id)          => API.delete(`/clients/${id}`),

  // Notes
  getNotes:      (clientId)    => API.get(`/clients/${clientId}/notes`),
  createNote:    (clientId, d) => API.post(`/clients/${clientId}/notes`, d),
  deleteNote:    (noteId)      => API.delete(`/notes/${noteId}`),

  // Projects
  getProjects:   (params = {}) => API.get('/projects?' + new URLSearchParams(params)),
  getProject:    (id)          => API.get(`/projects/${id}`),
  createProject: (data)        => API.post('/projects', data),
  updateProject: (id, data)    => API.put(`/projects/${id}`, data),
  deleteProject: (id)          => API.delete(`/projects/${id}`),

  // Invoices
  getInvoices:   (params = {}) => API.get('/invoices?' + new URLSearchParams(params)),
  getInvoice:    (id)          => API.get(`/invoices/${id}`),
  createInvoice: (data)        => API.post('/invoices', data),
  updateInvoice: (id, data)    => API.put(`/invoices/${id}`, data),
  deleteInvoice: (id)          => API.delete(`/invoices/${id}`),
};
