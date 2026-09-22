// ─── Invoices Page ────────────────────────────────────────────────────────────

let invoicesState = { filter: 'all', data: [], clients: [] };

async function renderInvoices() {
  const container = document.getElementById('page-content');
  container.innerHTML = buildInvoicesShell();
  bindInvoiceFilters();
  await loadInvoices();
}

function buildInvoicesShell() {
  return `
    <div class="section-header" style="margin-bottom:20px;">
      <div class="filter-group" id="invoice-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="draft">Draft</button>
        <button class="filter-btn" data-filter="sent">Sent</button>
        <button class="filter-btn" data-filter="paid">Paid</button>
        <button class="filter-btn" data-filter="overdue">Overdue</button>
      </div>
    </div>
    <div id="invoices-list" style="display:flex;flex-direction:column;gap:10px;"></div>`;
}

function bindInvoiceFilters() {
  document.querySelectorAll('#invoice-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#invoice-filters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      invoicesState.filter = btn.dataset.filter;
      renderInvoiceList();
    });
  });
}

async function loadInvoices() {
  const list = document.getElementById('invoices-list');
  if (!list) return;

  list.innerHTML = [1,2,3].map(() => `<div class="invoice-card"><div class="skeleton" style="height:52px;flex:1;"></div></div>`).join('');

  try {
    const [invoices, clients] = await Promise.all([
      API.getInvoices(),
      API.getClients(),
    ]);
    invoicesState.data    = invoices;
    invoicesState.clients = clients;

    const overdue = invoices.filter(i => i.status === 'overdue').length;
    const badge = document.getElementById('badge-invoices');
    if (badge) badge.textContent = overdue || '';

    renderInvoiceList();
  } catch {
    list.innerHTML = `<div class="empty-state"><h3>Error loading invoices</h3></div>`;
  }
}

function renderInvoiceList() {
  const list = document.getElementById('invoices-list');
  if (!list) return;

  let invoices = invoicesState.data;
  if (invoicesState.filter !== 'all') {
    invoices = invoices.filter(i => i.status === invoicesState.filter);
  }

  if (!invoices.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <h3>No invoices found</h3>
        <p>Create your first invoice to start tracking payments.</p>
        <button class="btn btn-primary" onclick="openInvoiceModal()">New Invoice</button>
      </div>`;
    return;
  }

  list.innerHTML = invoices.map(i => invoiceCard(i)).join('');

  list.querySelectorAll('.invoice-card[data-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.inv-actions')) return;
      openInvoiceDetail(card.dataset.id);
    });
  });

  list.querySelectorAll('.btn-edit-invoice').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openInvoiceModal(btn.dataset.id); });
  });

  list.querySelectorAll('.btn-delete-invoice').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const inv = invoicesState.data.find(i => i.id == btn.dataset.id);
      Utils.showConfirm('Delete Invoice', `Delete invoice <strong>${inv?.invoice_no}</strong>?`, () => deleteInvoice(btn.dataset.id));
    });
  });

  list.querySelectorAll('.btn-mark-paid').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await API.updateInvoice(btn.dataset.id, { status: 'paid' });
        showToast('Invoice marked as paid!', 'success');
        loadInvoices();
      } catch {}
    });
  });
}

function invoiceCard(i) {
  const showMarkPaid = ['sent', 'overdue'].includes(i.status);
  return `
    <div class="invoice-card" data-id="${i.id}" style="cursor:pointer;">
      ${Utils.avatar(i.client_name, i.avatar_color)}
      <div style="flex:1;min-width:0;">
        <div class="invoice-card-num">${i.invoice_no}</div>
        <div class="invoice-card-client">${i.client_name}</div>
        <div class="invoice-card-company">${i.client_company || ''}</div>
      </div>
      <div style="text-align:right;">
        <div class="invoice-card-date">Due ${Utils.formatDate(i.due_date)}</div>
        ${Utils.statusBadge(i.status)}
      </div>
      <div style="text-align:right;">
        <div class="invoice-card-amount">${Utils.formatCurrency(i.total)}</div>
      </div>
      <div class="inv-actions" style="display:flex;gap:4px;">
        ${showMarkPaid ? `<button class="btn btn-sm btn-ghost btn-mark-paid" data-id="${i.id}" title="Mark Paid" style="color:var(--green);border-color:rgba(16,185,129,0.3);">✓ Paid</button>` : ''}
        <button class="icon-btn btn-edit-invoice" data-id="${i.id}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn btn-delete-invoice" data-id="${i.id}" title="Delete" style="color:var(--red);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`;
}

async function deleteInvoice(id) {
  try {
    await API.deleteInvoice(id);
    showToast('Invoice deleted', 'info');
    loadInvoices();
  } catch {}
}

// ─── Invoice Detail ───────────────────────────────────────────────────────────

async function openInvoiceDetail(id) {
  Utils.openModal('Invoice', `<div style="padding:40px;text-align:center;"><div class="skeleton" style="height:300px;"></div></div>`, 'lg');

  try {
    const inv = await API.getInvoice(id);
    document.getElementById('modal-title').textContent = inv.invoice_no;

    document.getElementById('modal-body').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:22px;font-weight:800;color:var(--accent);">${inv.invoice_no}</div>
          <div style="color:var(--text-secondary);font-size:14px;margin-top:4px;">Issued ${Utils.formatDate(inv.created_at)}</div>
        </div>
        <div style="text-align:right;">
          ${Utils.statusBadge(inv.status)}
          <div style="font-size:28px;font-weight:800;margin-top:8px;">${Utils.formatCurrency(inv.total)}</div>
          <div style="font-size:13px;color:var(--text-muted);">Due ${Utils.formatDate(inv.due_date)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div style="background:var(--bg-elevated);padding:16px;border-radius:var(--radius-sm);">
          <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:8px;">Bill To</div>
          <div style="font-weight:700;">${inv.client_name}</div>
          ${inv.client_email ? `<div style="font-size:13px;color:var(--text-secondary);">${inv.client_email}</div>` : ''}
          ${inv.client_address ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${inv.client_address}</div>` : ''}
        </div>
        ${inv.paid_date ? `
        <div style="background:var(--green-soft);padding:16px;border-radius:var(--radius-sm);border:1px solid rgba(16,185,129,0.2);">
          <div style="font-size:11px;text-transform:uppercase;color:var(--green);font-weight:700;margin-bottom:8px;">Payment Received</div>
          <div style="font-weight:700;color:var(--green);">${Utils.formatDate(inv.paid_date)}</div>
        </div>` : '<div></div>'}
      </div>

      <div style="background:var(--bg-elevated);border-radius:var(--radius-sm);overflow:hidden;margin-bottom:20px;">
        <table class="invoice-items-table">
          <thead><tr><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>
            ${(inv.items || []).map(item => `
              <tr>
                <td>${item.desc}</td>
                <td style="text-align:center;">${item.qty}</td>
                <td style="text-align:right;">${Utils.formatCurrency(item.rate)}</td>
                <td style="text-align:right;font-weight:600;">${Utils.formatCurrency(item.qty * item.rate)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="invoice-totals">
        <div class="invoice-total-row"><span style="color:var(--text-secondary);">Subtotal</span><span>${Utils.formatCurrency(inv.subtotal)}</span></div>
        <div class="invoice-total-row"><span style="color:var(--text-secondary);">Tax</span><span>${Utils.formatCurrency(inv.tax)}</span></div>
        <div class="invoice-total-row grand"><span>Total</span><span style="color:var(--accent);">${Utils.formatCurrency(inv.total)}</span></div>
      </div>

      <div class="modal-footer">
        ${['sent','overdue'].includes(inv.status) ? `
          <button class="btn btn-ghost" onclick="markInvoicePaid(${inv.id})" style="color:var(--green);">✓ Mark as Paid</button>` : ''}
        <button class="btn btn-secondary" onclick="openInvoiceModal(${inv.id});Utils.closeModal();">✏️ Edit</button>
        <button class="btn btn-secondary" onclick="Utils.closeModal()">Close</button>
      </div>`;
  } catch {
    document.getElementById('modal-body').innerHTML = `<div class="empty-state"><h3>Failed to load invoice</h3></div>`;
  }
}

async function markInvoicePaid(id) {
  try {
    await API.updateInvoice(id, { status: 'paid' });
    showToast('Invoice marked as paid!', 'success');
    Utils.closeModal();
    loadInvoices();
  } catch {}
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────

async function openInvoiceModal(id = null) {
  const isEdit = !!id;
  let inv = null;
  if (isEdit) inv = await API.getInvoice(id).catch(() => null);

  let clients = invoicesState.clients;
  if (!clients.length) clients = await API.getClients().catch(() => []);

  let lineItems = inv?.items?.length ? inv.items : [{ desc: '', qty: 1, rate: 0 }];

  const renderLineItems = () => {
    const container = document.getElementById('line-items-container');
    if (!container) return;
    container.innerHTML = lineItems.map((item, idx) => `
      <div class="line-item-row">
        <input class="form-control li-desc" type="text" value="${item.desc || ''}" placeholder="Description" data-idx="${idx}" />
        <input class="form-control li-qty" type="number" min="1" value="${item.qty || 1}" data-idx="${idx}" style="text-align:center;" />
        <input class="form-control li-rate" type="number" min="0" step="0.01" value="${item.rate || ''}" placeholder="0.00" data-idx="${idx}" />
        <button class="icon-btn" data-idx="${idx}" onclick="removeLineItem(${idx})" style="color:var(--red);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');

    // Bind input changes
    container.querySelectorAll('.li-desc').forEach(el => {
      el.addEventListener('input', () => { lineItems[el.dataset.idx].desc = el.value; updateTotal(); });
    });
    container.querySelectorAll('.li-qty').forEach(el => {
      el.addEventListener('input', () => { lineItems[el.dataset.idx].qty = parseFloat(el.value) || 0; updateTotal(); });
    });
    container.querySelectorAll('.li-rate').forEach(el => {
      el.addEventListener('input', () => { lineItems[el.dataset.idx].rate = parseFloat(el.value) || 0; updateTotal(); });
    });
  };

  window.removeLineItem = (idx) => {
    lineItems.splice(idx, 1);
    if (!lineItems.length) lineItems = [{ desc: '', qty: 1, rate: 0 }];
    renderLineItems();
    updateTotal();
  };

  const updateTotal = () => {
    const sub = lineItems.reduce((s, i) => s + (i.qty * i.rate), 0);
    const tax = parseFloat(document.getElementById('if-tax')?.value || 0);
    const taxAmt = sub * (tax / 100);
    const el = document.getElementById('inv-total-preview');
    if (el) el.textContent = Utils.formatCurrency(sub + taxAmt) + ` (subtotal ${Utils.formatCurrency(sub)}, tax ${Utils.formatCurrency(taxAmt)})`;
  };

  const formHtml = `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Client *</label>
        <select id="if-client" class="form-control">
          <option value="">-- Select client --</option>
          ${clients.map(c => `<option value="${c.id}" ${inv?.client_id == c.id ? 'selected' : ''}>${c.name}${c.company ? ' ('+c.company+')' : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="if-status" class="form-control">
          ${['draft','sent','paid','overdue'].map(s =>
            `<option value="${s}" ${(inv?.status || 'draft') === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="if-due" class="form-control" type="date" value="${inv?.due_date?.split('T')[0] || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Tax Rate (%)</label>
        <input id="if-tax" class="form-control" type="number" min="0" max="100" step="0.5" value="${inv ? Math.round((inv.tax / Math.max(inv.subtotal, 1)) * 100) : 10}" />
      </div>
      <div class="form-group full-width">
        <label class="form-label">Notes</label>
        <textarea id="if-notes" class="form-control" rows="2" placeholder="Optional payment notes...">${inv?.notes || ''}</textarea>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section-header" style="margin-bottom:12px;">
      <span class="section-title" style="font-size:14px;">Line Items</span>
      <button class="btn btn-ghost btn-sm" id="add-line-item">+ Add Item</button>
    </div>
    <div id="line-items-container" class="line-items-list"></div>

    <div style="text-align:right;font-size:13px;color:var(--text-secondary);margin-top:10px;" id="inv-total-preview"></div>

    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="if-submit">${isEdit ? 'Save Changes' : 'Create Invoice'}</button>
    </div>`;

  Utils.openModal(isEdit ? `Edit ${inv?.invoice_no}` : 'New Invoice', formHtml);

  renderLineItems();
  updateTotal();

  document.getElementById('if-tax').addEventListener('input', updateTotal);

  document.getElementById('add-line-item').addEventListener('click', () => {
    lineItems.push({ desc: '', qty: 1, rate: 0 });
    renderLineItems();
    updateTotal();
  });

  document.getElementById('if-submit').addEventListener('click', async () => {
    const client_id = document.getElementById('if-client').value;
    if (!client_id) { showToast('Please select a client', 'warning'); return; }

    // Read current line items from DOM
    document.querySelectorAll('.li-desc').forEach((el, i) => { if (lineItems[i]) lineItems[i].desc = el.value; });
    document.querySelectorAll('.li-qty').forEach((el, i)  => { if (lineItems[i]) lineItems[i].qty = parseFloat(el.value) || 1; });
    document.querySelectorAll('.li-rate').forEach((el, i) => { if (lineItems[i]) lineItems[i].rate = parseFloat(el.value) || 0; });

    const data = {
      client_id: Number(client_id),
      status:    document.getElementById('if-status').value,
      due_date:  document.getElementById('if-due').value || null,
      tax:       parseFloat(document.getElementById('if-tax').value) || 0,
      notes:     document.getElementById('if-notes').value.trim() || null,
      items:     lineItems.filter(i => i.desc.trim()),
    };

    if (!data.items.length) { showToast('Add at least one line item', 'warning'); return; }

    const btn = document.getElementById('if-submit');
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
      if (isEdit) {
        await API.updateInvoice(id, data);
        showToast('Invoice updated!', 'success');
      } else {
        await API.createInvoice(data);
        showToast('Invoice created!', 'success');
      }
      Utils.closeModal();
      loadInvoices();
    } catch {
      btn.disabled = false;
      btn.textContent = isEdit ? 'Save Changes' : 'Create Invoice';
    }
  });
}
