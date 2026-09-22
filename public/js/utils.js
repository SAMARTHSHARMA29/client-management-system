// ─── Utility Functions ────────────────────────────────────────────────────────

const Utils = {
  formatCurrency(amount, symbol = '$') {
    if (!amount && amount !== 0) return `${symbol}0.00`;
    return `${symbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return '—'; }
  },

  formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const d = new Date(dateStr);
    const diff = now - d;
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 2)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7)   return `${days}d ago`;
    return Utils.formatDate(dateStr);
  },

  getInitials(name = '') {
    return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  },

  statusBadge(status) {
    const s = (status || '').toLowerCase().replace(' ', '-');
    return `<span class="badge badge-${s}">${status}</span>`;
  },

  progressBar(pct, color = '') {
    const c = pct >= 100 ? 'green' : pct >= 60 ? '' : pct >= 30 ? 'yellow' : 'red';
    return `
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="progress-bar" style="flex:1;">
          <div class="progress-fill ${color || c}" style="width:${Math.min(pct,100)}%;"></div>
        </div>
        <span style="font-size:12px;color:var(--text-muted);min-width:32px;">${pct}%</span>
      </div>`;
  },

  avatar(name, color, size = '') {
    const cls = size ? `avatar avatar-${size}` : 'avatar';
    return `<div class="${cls}" style="background:${color || '#6366f1'};">${Utils.getInitials(name)}</div>`;
  },

  activityDotColor(type) {
    const map = {
      client_created: 'accent', client_updated: 'blue', client_deleted: 'red',
      project_created: 'blue', project_updated: 'purple', project_completed: 'green', project_deleted: 'red',
      invoice_created: 'yellow', invoice_paid: 'green', invoice_sent: 'blue', invoice_overdue: 'red',
      note_added: 'purple',
    };
    return map[type] || 'accent';
  },

  activityIcon(type) {
    const icons = {
      client_created: '👤', client_updated: '✏️', client_deleted: '🗑️',
      project_created: '📁', project_updated: '🔄', project_completed: '✅', project_deleted: '🗑️',
      invoice_created: '📄', invoice_paid: '💰', invoice_sent: '📨', invoice_overdue: '⚠️',
      note_added: '📝',
    };
    return icons[type] || '•';
  },

  tagHtml(tag) {
    return `<span class="tag">${tag}</span>`;
  },

  showConfirm(title, message, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    const modal   = document.getElementById('modal');
    const mTitle  = document.getElementById('modal-title');
    const mBody   = document.getElementById('modal-body');

    mTitle.textContent = '';
    modal.className = 'modal';
    mBody.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="confirm-btns">
          <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
          <button class="btn btn-danger" id="confirm-ok">Delete</button>
        </div>
      </div>`;

    overlay.classList.remove('hidden');
    document.getElementById('confirm-cancel').onclick = () => overlay.classList.add('hidden');
    document.getElementById('confirm-ok').onclick = () => { overlay.classList.add('hidden'); onConfirm(); };
    document.getElementById('modal-close').onclick = () => overlay.classList.add('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  openModal(title, bodyHtml, size = '') {
    const overlay = document.getElementById('modal-overlay');
    const modal   = document.getElementById('modal');
    const mTitle  = document.getElementById('modal-title');
    const mBody   = document.getElementById('modal-body');

    mTitle.textContent = title;
    modal.className = `modal${size ? ' modal-' + size : ''}`;
    mBody.innerHTML = bodyHtml;
    overlay.classList.remove('hidden');
    document.getElementById('modal-close').onclick = () => overlay.classList.add('hidden');
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };
  },
};

// ─── Toast Notifications ──────────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span>`;
  container.appendChild(toast);
  toast.onclick = () => toast.remove();
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
