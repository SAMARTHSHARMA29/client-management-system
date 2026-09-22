// ─── App Router & Global Logic ──────────────────────────────────────────────────

const App = {
  currentRoute: 'dashboard',

  routes: {
    dashboard: { render: renderDashboard, title: 'Dashboard', addLabel: 'Add Client', addAction: () => openClientModal() },
    clients:   { render: renderClients,   title: 'Clients',   addLabel: 'Add Client', addAction: () => openClientModal() },
    projects:  { render: renderProjects,  title: 'Projects',  addLabel: 'Add Project', addAction: () => openProjectModal() },
    invoices:  { render: renderInvoices,  title: 'Invoices',  addLabel: 'Add Invoice', addAction: () => openInvoiceModal() },
  },

  async init() {
    this.bindEvents();
    this.handleRoute();
    await this.updateBadges();
  },

  bindEvents() {
    // Hash routing
    window.addEventListener('hashchange', () => this.handleRoute());

    // Sidebar toggle (mobile/responsive)
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Global Search
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (this.currentRoute === 'clients' && typeof clientsState !== 'undefined') {
          clientsState.search = query;
          if (typeof loadClients === 'function') loadClients();
        } else if (this.currentRoute === 'projects' && typeof projectsState !== 'undefined') {
          if (typeof renderProjectGrid === 'function') {
            const grid = document.getElementById('projects-grid');
            if (grid && projectsState.data) {
              const filtered = projectsState.data.filter(p =>
                p.name.toLowerCase().includes(query) || (p.client_name && p.client_name.toLowerCase().includes(query))
              );
              grid.innerHTML = filtered.length ? filtered.map(p => projectCard(p)).join('') : '<div class="empty-state">No matching projects</div>';
            }
          }
        }
      });
    }

    // Primary action button
    const addBtn = document.getElementById('btn-add-primary');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const routeConfig = this.routes[this.currentRoute];
        if (routeConfig && routeConfig.addAction) {
          routeConfig.addAction();
        }
      });
    }
  },

  handleRoute() {
    let hash = window.location.hash.slice(1);
    if (!hash || !this.routes[hash]) {
      hash = 'dashboard';
    }

    this.currentRoute = hash;

    // Update active nav link
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
      if (link.getAttribute('data-page') === hash) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update page title
    const titleEl = document.getElementById('page-title');
    const routeConfig = this.routes[hash];
    if (titleEl && routeConfig) {
      titleEl.textContent = routeConfig.title;
    }

    // Update primary add button label
    const btnAddLabel = document.getElementById('btn-add-label');
    if (btnAddLabel && routeConfig) {
      btnAddLabel.textContent = routeConfig.addLabel;
    }

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Render route view
    if (routeConfig && typeof routeConfig.render === 'function') {
      routeConfig.render();
    }
  },

  async updateBadges() {
    try {
      const stats = await API.getDashboardStats();
      const clientBadge = document.getElementById('badge-clients');
      const projectBadge = document.getElementById('badge-projects');
      const invoiceBadge = document.getElementById('badge-invoices');

      if (clientBadge) clientBadge.textContent = stats.totalClients || '';
      if (projectBadge) projectBadge.textContent = stats.activeProjects || '';
      if (invoiceBadge) {
        if (stats.overdueInvoices > 0) {
          invoiceBadge.textContent = stats.overdueInvoices;
          invoiceBadge.style.display = 'inline-flex';
        } else {
          invoiceBadge.style.display = 'none';
        }
      }
    } catch (e) {
      console.warn('Failed to fetch badge counts:', e);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
