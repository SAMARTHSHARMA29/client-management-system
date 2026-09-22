// ─── Projects Page ────────────────────────────────────────────────────────────

let projectsState = { filter: 'all', data: [], clients: [] };

async function renderProjects() {
  const container = document.getElementById('page-content');
  container.innerHTML = buildProjectsShell();
  bindProjectFilters();
  await loadProjects();
}

function buildProjectsShell() {
  return `
    <div class="section-header" style="margin-bottom:20px;">
      <div>
        <div class="filter-group" id="project-filters">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="active">Active</button>
          <button class="filter-btn" data-filter="planning">Planning</button>
          <button class="filter-btn" data-filter="completed">Completed</button>
          <button class="filter-btn" data-filter="on-hold">On Hold</button>
        </div>
      </div>
    </div>
    <div id="projects-grid" class="projects-grid"></div>`;
}

function bindProjectFilters() {
  document.querySelectorAll('#project-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#project-filters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      projectsState.filter = btn.dataset.filter;
      renderProjectGrid();
    });
  });
}

async function loadProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;
  grid.innerHTML = [1,2,3,4,5,6].map(() => `
    <div class="project-card" style="min-height:160px;">
      <div class="skeleton" style="height:20px;width:60%;"></div>
      <div class="skeleton" style="height:14px;width:40%;margin-top:8px;"></div>
      <div class="skeleton" style="height:6px;margin-top:20px;"></div>
    </div>`).join('');

  try {
    const [projects, clients] = await Promise.all([
      API.getProjects(),
      API.getClients(),
    ]);
    projectsState.data = projects;
    projectsState.clients = clients;

    // Update badge
    const active = projects.filter(p => p.status === 'active').length;
    const badge = document.getElementById('badge-projects');
    if (badge) badge.textContent = active || '';

    renderProjectGrid();
  } catch (e) {
    grid.innerHTML = `<div class="empty-state"><h3>Error loading projects</h3></div>`;
  }
}

function renderProjectGrid() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  let projects = projectsState.data;
  if (projectsState.filter !== 'all') {
    projects = projects.filter(p => p.status === projectsState.filter);
  }

  if (!projects.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <h3>No projects found</h3>
        <p>Create your first project to get started.</p>
        <button class="btn btn-primary" onclick="openProjectModal()">New Project</button>
      </div>`;
    return;
  }

  grid.innerHTML = projects.map(p => projectCard(p)).join('');

  grid.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.proj-actions')) return;
      openProjectModal(card.dataset.id);
    });
  });

  grid.querySelectorAll('.btn-delete-project').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = projectsState.data.find(x => x.id == btn.dataset.id);
      Utils.showConfirm('Delete Project', `Delete <strong>${p?.name}</strong>?`, () => deleteProject(btn.dataset.id));
    });
  });
}

function projectCard(p) {
  const budgetUsed = p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
  return `
    <div class="project-card" data-id="${p.id}">
      <div class="project-card-header">
        <div style="flex:1;min-width:0;">
          <div class="project-name">${p.name}</div>
          <div class="project-client">
            ${Utils.avatar(p.client_name, p.avatar_color, 'sm')}
            ${p.client_name}${p.client_company ? ' · ' + p.client_company : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${Utils.statusBadge(p.status)}
          <button class="icon-btn btn-delete-project" data-id="${p.id}" style="color:var(--red);width:26px;height:26px;" title="Delete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>

      ${p.description ? `<p style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin:-4px 0;">${p.description.slice(0,100)}${p.description.length > 100 ? '...' : ''}</p>` : ''}

      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px;">
          <span>Progress</span><span>${p.progress}%</span>
        </div>
        <div class="progress-bar" style="height:8px;">
          <div class="progress-fill ${p.progress>=100?'green':p.progress>=60?'':p.progress>=30?'yellow':'red'}" style="width:${Math.min(p.progress,100)}%;"></div>
        </div>
      </div>

      <div class="project-meta">
        <div class="project-meta-item">
          <span class="project-meta-label">Budget</span>
          <span class="project-meta-value">${Utils.formatCurrency(p.budget)}</span>
        </div>
        <div class="project-meta-item">
          <span class="project-meta-label">Spent</span>
          <span class="project-meta-value ${budgetUsed > 90 ? 'text-red' : ''}">${Utils.formatCurrency(p.spent)}</span>
        </div>
        ${p.deadline ? `
        <div class="project-meta-item" style="grid-column:1/-1;">
          <span class="project-meta-label">Deadline</span>
          <span class="project-meta-value">${Utils.formatDate(p.deadline)}</span>
        </div>` : ''}
      </div>
    </div>`;
}

async function deleteProject(id) {
  try {
    await API.deleteProject(id);
    showToast('Project deleted', 'info');
    loadProjects();
  } catch {}
}

// ─── Project Modal ────────────────────────────────────────────────────────────

async function openProjectModal(id = null) {
  const isEdit = !!id;
  let proj = null;
  if (isEdit) proj = await API.getProject(id).catch(() => null);

  let clients = projectsState.clients;
  if (!clients.length) clients = await API.getClients().catch(() => []);

  const formHtml = `
    <div class="form-grid">
      <div class="form-group full-width">
        <label class="form-label">Project Name *</label>
        <input id="pf-name" class="form-control" type="text" value="${proj?.name || ''}" placeholder="e.g. Brand Redesign 2024" />
      </div>
      <div class="form-group full-width">
        <label class="form-label">Description</label>
        <textarea id="pf-desc" class="form-control" rows="2" placeholder="Brief description of the project...">${proj?.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Client *</label>
        <select id="pf-client" class="form-control">
          <option value="">-- Select client --</option>
          ${clients.map(c => `<option value="${c.id}" ${proj?.client_id == c.id ? 'selected' : ''}>${c.name}${c.company ? ' ('+c.company+')' : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="pf-status" class="form-control">
          ${['planning','active','on-hold','completed'].map(s =>
            `<option value="${s}" ${proj?.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Budget ($)</label>
        <input id="pf-budget" class="form-control" type="number" min="0" step="100" value="${proj?.budget || ''}" placeholder="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Spent ($)</label>
        <input id="pf-spent" class="form-control" type="number" min="0" step="100" value="${proj?.spent || ''}" placeholder="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Deadline</label>
        <input id="pf-deadline" class="form-control" type="date" value="${proj?.deadline?.split('T')[0] || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Progress (%)</label>
        <input id="pf-progress" class="form-control" type="number" min="0" max="100" value="${proj?.progress ?? 0}" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="pf-submit">${isEdit ? 'Save Changes' : 'Create Project'}</button>
    </div>`;

  Utils.openModal(isEdit ? 'Edit Project' : 'New Project', formHtml);

  document.getElementById('pf-submit').addEventListener('click', async () => {
    const name      = document.getElementById('pf-name').value.trim();
    const client_id = document.getElementById('pf-client').value;
    if (!name)      { showToast('Project name is required', 'warning'); return; }
    if (!client_id) { showToast('Please select a client', 'warning'); return; }

    const data = {
      client_id: Number(client_id),
      name,
      description: document.getElementById('pf-desc').value.trim() || null,
      status:      document.getElementById('pf-status').value,
      budget:      parseFloat(document.getElementById('pf-budget').value) || 0,
      spent:       parseFloat(document.getElementById('pf-spent').value) || 0,
      deadline:    document.getElementById('pf-deadline').value || null,
      progress:    parseInt(document.getElementById('pf-progress').value) || 0,
    };

    const btn = document.getElementById('pf-submit');
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
      if (isEdit) {
        await API.updateProject(id, data);
        showToast('Project updated!', 'success');
      } else {
        await API.createProject(data);
        showToast('Project created!', 'success');
      }
      Utils.closeModal();
      loadProjects();
    } catch {
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save Changes' : 'Create Project';
    }
  });
}
