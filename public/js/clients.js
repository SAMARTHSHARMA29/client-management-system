// ─── Clients Page ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];

let clientsState = { filter: 'all', search: '', data: [] };

async function renderClients() {
  const container = document.getElementById('page-content');
  container.innerHTML = buildClientsShell();
  bindClientFilters();
  await loadClients();
}

function buildClientsShell() {
  return `
    <div class="table-container">
      <div class="table-toolbar">
        <div class="filter-group" id="client-filters">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="active">Active</button>
          <button class="filter-btn" data-filter="prospect">Prospect</button>
          <button class="filter-btn" data-filter="inactive">Inactive</button>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="search-bar" style="width:220px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="client-search" type="text" placeholder="Search clients..." value="${clientsState.search}" />
          </div>
        </div>
      </div>
      <div id="clients-list"></div>
    </div>`;
}

function bindClientFilters() {
  document.querySelectorAll('#client-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#client-filters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      clientsState.filter = btn.dataset.filter;
      loadClients();
    });
  });

  const searchInput = document.getElementById('client-search');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      clientsState.search = searchInput.value;
      timer = setTimeout(() => loadClients(), 300);
    });
  }
}

async function loadClients() {
  const list = document.getElementById('clients-list');
  if (!list) return;

  const params = {};
  if (clientsState.filter !== 'all') params.status = clientsState.filter;
  if (clientsState.search) params.search = clientsState.search;

  list.innerHTML = `<div style="padding:40px;text-align:center;">
    <div class="skeleton" style="height:52px;margin-bottom:8px;"></div>
    <div class="skeleton" style="height:52px;margin-bottom:8px;"></div>
    <div class="skeleton" style="height:52px;"></div>
  </div>`;

  try {
    const clients = await API.getClients(params);
    clientsState.data = clients;

    // Update nav badge
    const badge = document.getElementById('badge-clients');
    if (badge) badge.textContent = clients.length || '';

    if (!clients.length) {
      list.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <h3>No clients found</h3>
          <p>Add your first client to get started or try adjusting the filters.</p>
          <button class="btn btn-primary" onclick="openClientModal()">Add Client</button>
        </div>`;
      return;
    }

    list.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Status</th>
            <th>Tags</th>
            <th>Projects</th>
            <th>Revenue</th>
            <th>Joined</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${clients.map(c => clientRow(c)).join('')}
        </tbody>
      </table>`;

    // Row click → detail
    list.querySelectorAll('tbody tr[data-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.row-actions')) return;
        openClientDetail(row.dataset.id);
      });
    });

    // Action buttons
    list.querySelectorAll('.btn-edit-client').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openClientModal(btn.dataset.id); });
    });
    list.querySelectorAll('.btn-delete-client').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const client = clientsState.data.find(c => c.id == btn.dataset.id);
        Utils.showConfirm(
          'Delete Client',
          `Are you sure you want to delete <strong>${client?.name}</strong>? This will also delete all their projects, invoices, and notes.`,
          () => deleteClient(btn.dataset.id)
        );
      });
    });
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><h3>Error loading clients</h3></div>`;
  }
}

function clientRow(c) {
  const tags = (c.tags || []).slice(0, 2).map(Utils.tagHtml).join('') +
    (c.tags?.length > 2 ? `<span class="tag">+${c.tags.length - 2}</span>` : '');

  return `
    <tr data-id="${c.id}" style="cursor:pointer;">
      <td>
        <div class="client-cell">
          ${Utils.avatar(c.name, c.avatar_color)}
          <div class="client-cell-info">
            <span class="client-cell-name">${c.name}</span>
            <span class="client-cell-sub">${c.company || c.email || '—'}</span>
          </div>
        </div>
      </td>
      <td>${Utils.statusBadge(c.status)}</td>
      <td><div class="tags-group">${tags || '<span style="color:var(--text-muted);">—</span>'}</div></td>
      <td><span style="font-weight:600;">${c.projectCount}</span> <span style="color:var(--text-muted);font-size:12px;">projects</span></td>
      <td style="font-weight:600;">${Utils.formatCurrency(c.totalRevenue)}</td>
      <td style="color:var(--text-muted);font-size:13px;">${Utils.formatDate(c.created_at)}</td>
      <td>
        <div class="row-actions" style="display:flex;gap:4px;justify-content:flex-end;">
          <button class="icon-btn btn-edit-client" data-id="${c.id}" title="Edit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn btn-delete-client" data-id="${c.id}" title="Delete" style="color:var(--red);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

async function deleteClient(id) {
  try {
    await API.deleteClient(id);
    showToast('Client deleted successfully', 'success');
    loadClients();
  } catch (e) {
    showToast('Failed to delete client', 'error');
  }
}

// ─── Client Modal (Create / Edit) ────────────────────────────────────────────

function openClientModal(id = null) {
  const isEdit = !!id;
  const client = isEdit ? clientsState.data.find(c => c.id == id) : null;

  let selectedColor = client?.avatar_color || AVATAR_COLORS[0];

  const formHtml = `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Full Name *</label>
        <input id="cf-name" class="form-control" type="text" value="${client?.name || ''}" placeholder="e.g. Jane Smith" required />
      </div>
      <div class="form-group">
        <label class="form-label">Company</label>
        <input id="cf-company" class="form-control" type="text" value="${client?.company || ''}" placeholder="e.g. Acme Corp" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input id="cf-email" class="form-control" type="email" value="${client?.email || ''}" placeholder="jane@company.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input id="cf-phone" class="form-control" type="text" value="${client?.phone || ''}" placeholder="+1 (555) 000-0000" />
      </div>
      <div class="form-group full-width">
        <label class="form-label">Address</label>
        <input id="cf-address" class="form-control" type="text" value="${client?.address || ''}" placeholder="Street, City, State, Country" />
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="cf-status" class="form-control">
          <option value="active"   ${client?.status === 'active'   ? 'selected' : ''}>Active</option>
          <option value="prospect" ${client?.status === 'prospect' ? 'selected' : ''}>Prospect</option>
          <option value="inactive" ${client?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tags (comma-separated)</label>
        <input id="cf-tags" class="form-control" type="text" value="${(client?.tags || []).join(', ')}" placeholder="design, web, saas" />
      </div>
      <div class="form-group full-width">
        <label class="form-label">Avatar Color</label>
        <div class="color-swatches" id="color-swatches">
          ${AVATAR_COLORS.map(c => `
            <div class="color-swatch ${c === selectedColor ? 'selected' : ''}" 
                 data-color="${c}" style="background:${c};" title="${c}"></div>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="cf-submit">${isEdit ? 'Save Changes' : 'Create Client'}</button>
    </div>`;

  Utils.openModal(isEdit ? 'Edit Client' : 'New Client', formHtml);

  // Color swatches
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = sw.dataset.color;
    });
  });

  document.getElementById('cf-submit').addEventListener('click', async () => {
    const name = document.getElementById('cf-name').value.trim();
    if (!name) { showToast('Client name is required', 'warning'); return; }

    const data = {
      name,
      company:      document.getElementById('cf-company').value.trim() || null,
      email:        document.getElementById('cf-email').value.trim() || null,
      phone:        document.getElementById('cf-phone').value.trim() || null,
      address:      document.getElementById('cf-address').value.trim() || null,
      status:       document.getElementById('cf-status').value,
      tags:         document.getElementById('cf-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      avatar_color: selectedColor,
    };

    const btn = document.getElementById('cf-submit');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      if (isEdit) {
        await API.updateClient(id, data);
        showToast('Client updated!', 'success');
      } else {
        await API.createClient(data);
        showToast('Client created!', 'success');
      }
      Utils.closeModal();
      loadClients();
    } catch {
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save Changes' : 'Create Client';
    }
  });
}

// ─── Client Detail ────────────────────────────────────────────────────────────

async function openClientDetail(id) {
  Utils.openModal('Loading...', `<div style="padding:40px;text-align:center;">
    <div class="skeleton" style="height:200px;"></div></div>`, 'xl');

  try {
    const c = await API.getClient(id);
    document.getElementById('modal-title').textContent = c.name;

    const tabs = ['Overview', 'Projects', 'Invoices', 'Notes'];

    document.getElementById('modal-body').innerHTML = `
      <div class="detail-layout">
        <div class="detail-sidebar">
          <div class="detail-profile">
            ${Utils.avatar(c.name, c.avatar_color, 'lg')}
            <div>
              <div style="font-size:18px;font-weight:700;">${c.name}</div>
              <div style="font-size:13px;color:var(--text-muted);">${c.company || ''}</div>
            </div>
            ${Utils.statusBadge(c.status)}
            <div class="detail-actions">
              <button class="btn btn-sm btn-secondary" onclick="openClientModal(${c.id});Utils.closeModal();">
                ✏️ Edit
              </button>
            </div>
            <div class="detail-info-grid">
              ${c.email ? `<div class="detail-info-item"><div class="detail-info-label">Email</div><div class="detail-info-value">${c.email}</div></div>` : ''}
              ${c.phone ? `<div class="detail-info-item"><div class="detail-info-label">Phone</div><div class="detail-info-value">${c.phone}</div></div>` : ''}
              ${c.address ? `<div class="detail-info-item"><div class="detail-info-label">Address</div><div class="detail-info-value">${c.address}</div></div>` : ''}
              <div class="detail-info-item"><div class="detail-info-label">Member since</div><div class="detail-info-value">${Utils.formatDate(c.created_at)}</div></div>
            </div>
            ${c.tags?.length ? `<div class="tags-group" style="justify-content:center;">${c.tags.map(Utils.tagHtml).join('')}</div>` : ''}
          </div>

          <div class="stats-row" style="grid-template-columns:1fr 1fr;">
            <div class="stat-item">
              <div class="stat-value">${c.projects?.length || 0}</div>
              <div class="stat-label">Projects</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${c.invoices?.length || 0}</div>
              <div class="stat-label">Invoices</div>
            </div>
            <div class="stat-item" style="grid-column:1/-1;">
              <div class="stat-value text-green">${Utils.formatCurrency(c.totalRevenue)}</div>
              <div class="stat-label">Total Revenue</div>
            </div>
          </div>
        </div>

        <div class="detail-main">
          <div class="detail-tabs">
            ${tabs.map((t, i) => `<button class="detail-tab ${i===0?'active':''}" data-tab="${t.toLowerCase()}">${t}</button>`).join('')}
          </div>
          <div class="tab-content" id="tab-content">
            ${buildClientProjects(c.projects)}
          </div>
        </div>
      </div>`;

    // Tab switching
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tc = document.getElementById('tab-content');
        switch (tab.dataset.tab) {
          case 'overview':  tc.innerHTML = buildClientProjects(c.projects); break;
          case 'projects':  tc.innerHTML = buildClientProjects(c.projects); break;
          case 'invoices':  tc.innerHTML = buildClientInvoices(c.invoices); break;
          case 'notes':     renderClientNotes(tc, c.id, c.notes); break;
        }
      });
    });

    // Default to overview
    document.getElementById('tab-content').innerHTML = buildClientOverview(c);
    document.querySelector('[data-tab="overview"]').onclick = () => {
      document.getElementById('tab-content').innerHTML = buildClientOverview(c);
    };
  } catch (e) {
    document.getElementById('modal-body').innerHTML = `<div class="empty-state"><h3>Failed to load client</h3></div>`;
  }
}

function buildClientOverview(c) {
  return `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div>
        <div class="section-header"><span class="section-title">Recent Projects</span></div>
        ${c.projects?.length ? c.projects.slice(0,3).map(p => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);margin-bottom:8px;">
            <div>
              <div style="font-weight:600;font-size:14px;">${p.name}</div>
              <div style="font-size:12px;color:var(--text-muted);">Due ${Utils.formatDate(p.deadline)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              ${Utils.statusBadge(p.status)}
              ${Utils.progressBar(p.progress)}
            </div>
          </div>`).join('') : '<p style="color:var(--text-muted);font-size:13px;">No projects yet.</p>'}
      </div>
      <div>
        <div class="section-header"><span class="section-title">Recent Invoices</span></div>
        ${c.invoices?.length ? c.invoices.slice(0,3).map(i => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);margin-bottom:8px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--accent);">${i.invoice_no}</div>
              <div style="font-size:12px;color:var(--text-muted);">Due ${Utils.formatDate(i.due_date)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              ${Utils.statusBadge(i.status)}
              <strong>${Utils.formatCurrency(i.total)}</strong>
            </div>
          </div>`).join('') : '<p style="color:var(--text-muted);font-size:13px;">No invoices yet.</p>'}
      </div>
    </div>`;
}

function buildClientProjects(projects = []) {
  if (!projects.length) return `<div class="empty-state" style="padding:30px;"><h3>No projects</h3><p>No projects have been created for this client.</p></div>`;
  return projects.map(p => `
    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;margin-bottom:10px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
        <div>
          <div style="font-weight:700;font-size:15px;">${p.name}</div>
          ${p.description ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${p.description}</div>` : ''}
        </div>
        ${Utils.statusBadge(p.status)}
      </div>
      ${Utils.progressBar(p.progress)}
      <div style="display:flex;gap:20px;margin-top:12px;font-size:12px;color:var(--text-muted);">
        <span>Budget: <strong style="color:var(--text-primary);">${Utils.formatCurrency(p.budget)}</strong></span>
        <span>Spent: <strong style="color:var(--text-primary);">${Utils.formatCurrency(p.spent)}</strong></span>
        ${p.deadline ? `<span>Deadline: <strong style="color:var(--text-primary);">${Utils.formatDate(p.deadline)}</strong></span>` : ''}
      </div>
    </div>`).join('');
}

function buildClientInvoices(invoices = []) {
  if (!invoices.length) return `<div class="empty-state" style="padding:30px;"><h3>No invoices</h3></div>`;
  return invoices.map(i => `
    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-weight:700;color:var(--accent);font-family:monospace;">${i.invoice_no}</div>
        <div style="font-size:12px;color:var(--text-muted);">Due ${Utils.formatDate(i.due_date)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:16px;">
        ${Utils.statusBadge(i.status)}
        <strong style="font-size:16px;">${Utils.formatCurrency(i.total)}</strong>
      </div>
    </div>`).join('');
}

function renderClientNotes(container, clientId, notes = []) {
  const refresh = async () => {
    const fresh = await API.getNotes(clientId);
    renderNotesList(container, clientId, fresh, refresh);
  };
  renderNotesList(container, clientId, notes, refresh);
}

function renderNotesList(container, clientId, notes, refresh) {
  container.innerHTML = `
    <div class="note-input-area">
      <textarea id="new-note-text" class="form-control" rows="3" placeholder="Write a note about this client..."></textarea>
      <div style="display:flex;justify-content:flex-end;">
        <button class="btn btn-primary btn-sm" id="save-note-btn">Add Note</button>
      </div>
    </div>
    <div class="notes-list" id="notes-list">
      ${notes.length ? notes.map(n => `
        <div class="note-item">
          <div class="note-meta">
            <span class="note-date">📝 ${Utils.formatRelativeTime(n.created_at)}</span>
            <button class="icon-btn" data-note-id="${n.id}" title="Delete note" style="color:var(--red);width:24px;height:24px;" onclick="deleteClientNote(${n.id},${clientId})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
          <p class="note-text">${n.content}</p>
        </div>`).join('') : '<p style="color:var(--text-muted);font-size:13px;">No notes yet.</p>'}
    </div>`;

  document.getElementById('save-note-btn').addEventListener('click', async () => {
    const content = document.getElementById('new-note-text').value.trim();
    if (!content) { showToast('Note cannot be empty', 'warning'); return; }
    try {
      await API.createNote(clientId, { content });
      showToast('Note added!', 'success');
      refresh();
    } catch {}
  });
}

async function deleteClientNote(noteId, clientId) {
  try {
    await API.deleteNote(noteId);
    showToast('Note deleted', 'info');
    const notes = await API.getNotes(clientId);
    const container = document.getElementById('tab-content');
    if (container) renderClientNotes(container, clientId, notes);
  } catch {}
}
