// ─── Dashboard Page ───────────────────────────────────────────────────────────

let revenueChart = null;
let distributionChart = null;

async function renderDashboard() {
  const container = document.getElementById('page-content');
  container.innerHTML = `
    <div class="kpi-grid">
      ${['','','',''].map(() => `
        <div class="kpi-card">
          <div class="skeleton" style="width:40px;height:40px;border-radius:8px;"></div>
          <div class="skeleton" style="width:70%;height:28px;margin-top:8px;"></div>
          <div class="skeleton" style="width:50%;height:14px;margin-top:4px;"></div>
        </div>`).join('')}
    </div>
    <div class="dashboard-grid">
      <div class="chart-card"><div class="skeleton" style="height:280px;"></div></div>
      <div class="chart-card"><div class="skeleton" style="height:280px;"></div></div>
    </div>`;

  try {
    const [stats, revenue, activity, dist] = await Promise.all([
      API.getDashboardStats(),
      API.getDashboardRevenue(),
      API.getDashboardActivity(),
      API.getClientDistribution(),
    ]);

    container.innerHTML = buildDashboardHTML(stats);

    // Destroy old charts before creating new ones
    if (revenueChart) { revenueChart.destroy(); revenueChart = null; }
    if (distributionChart) { distributionChart.destroy(); distributionChart = null; }

    renderRevenueChart(revenue);
    renderDistributionChart(dist);
    renderActivityFeed(activity);

  } catch (e) {
    container.innerHTML = `<div class="empty-state"><h3>Failed to load dashboard</h3><p>${e.message}</p></div>`;
  }
}

function buildDashboardHTML(s) {
  return `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon purple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div>
          <div class="kpi-value">${s.totalClients}</div>
          <div class="kpi-label">Total Clients</div>
        </div>
        <div class="kpi-sub">
          <span class="up">▲</span> ${s.activeClients} active &nbsp;·&nbsp; ${s.prospects} prospects
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon blue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div>
          <div class="kpi-value">${s.activeProjects}</div>
          <div class="kpi-label">Active Projects</div>
        </div>
        <div class="kpi-sub">${s.totalProjects} total projects</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon green">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div>
          <div class="kpi-value">${Utils.formatCurrency(s.totalRevenue)}</div>
          <div class="kpi-label">Total Revenue</div>
        </div>
        <div class="kpi-sub">
          <span class="text-yellow">⏳</span> ${Utils.formatCurrency(s.pendingRevenue)} pending
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon ${s.overdueInvoices > 0 ? 'red' : 'green'}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div>
          <div class="kpi-value ${s.overdueInvoices > 0 ? 'text-red' : ''}">${s.overdueInvoices}</div>
          <div class="kpi-label">Overdue Invoices</div>
        </div>
        <div class="kpi-sub">
          ${s.overdueInvoices > 0
            ? `<span class="down">▼</span> ${Utils.formatCurrency(s.overdueAmount)} at risk`
            : '<span class="up">✓</span> All invoices on track'}
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="chart-card">
        <div class="card-title">Revenue Overview <span style="font-size:11px;color:var(--text-muted);text-transform:none;font-weight:400;">Last 6 months</span></div>
        <canvas id="revenue-chart" height="240"></canvas>
      </div>
      <div class="chart-card">
        <div class="card-title">Client Distribution</div>
        <canvas id="distribution-chart" height="200"></canvas>
        <div id="dist-legend" style="margin-top:16px;display:flex;gap:16px;justify-content:center;flex-wrap:wrap;font-size:13px;"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Recent Activity</div>
      <div id="activity-feed" class="activity-list"></div>
    </div>`;
}

function renderRevenueChart(data) {
  const ctx = document.getElementById('revenue-chart');
  if (!ctx) return;
  revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Revenue',
        data: data.map(d => d.revenue),
        backgroundColor: 'rgba(99,102,241,0.25)',
        borderColor: '#6366f1',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: 'rgba(99,102,241,0.45)',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c1e28',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: { label: c => Utils.formatCurrency(c.raw) },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3b0', font: { size: 12 } } },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#9ca3b0', font: { size: 12 }, callback: v => `$${(v/1000).toFixed(0)}k` },
          beginAtZero: true,
        },
      },
    },
  });
}

function renderDistributionChart(dist) {
  const ctx = document.getElementById('distribution-chart');
  if (!ctx) return;

  distributionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Active', 'Prospect', 'Inactive'],
      datasets: [{
        data: [dist.active, dist.prospect, dist.inactive],
        backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(90,97,115,0.4)'],
        borderColor: ['#10b981', '#f59e0b', '#5a6173'],
        borderWidth: 2,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c1e28',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
        },
      },
    },
  });

  const legend = document.getElementById('dist-legend');
  if (legend) {
    const items = [
      { label: 'Active',   color: '#10b981', value: dist.active },
      { label: 'Prospect', color: '#f59e0b', value: dist.prospect },
      { label: 'Inactive', color: '#5a6173', value: dist.inactive },
    ];
    legend.innerHTML = items.map(i => `
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${i.color};"></div>
        <span style="color:var(--text-secondary);">${i.label}</span>
        <strong style="color:var(--text-primary);">${i.value}</strong>
      </div>`).join('');
  }
}

function renderActivityFeed(activities) {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;

  if (!activities.length) {
    feed.innerHTML = `<div class="empty-state" style="padding:30px;">
      <p>No recent activity</p></div>`;
    return;
  }

  feed.innerHTML = activities.map(a => `
    <div class="activity-item">
      <div class="activity-dot ${Utils.activityDotColor(a.type)}"></div>
      <div class="activity-text">
        <div class="activity-title">${a.title}</div>
        <div class="activity-desc">${a.description || ''}</div>
      </div>
      <div class="activity-time">${Utils.formatRelativeTime(a.created_at)}</div>
    </div>`).join('');
}
