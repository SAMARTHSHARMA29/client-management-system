const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helper ───────────────────────────────────────────────────────────────────

function logActivity(type, title, description, entity_type = null, entity_id = null) {
  db.prepare(`INSERT INTO activity_log (type, title, description, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)`)
    .run(type, title, description, entity_type, entity_id);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

app.get('/api/dashboard/stats', (req, res) => {
  const totalClients = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
  const activeClients = db.prepare("SELECT COUNT(*) as c FROM clients WHERE status='active'").get().c;
  const prospects = db.prepare("SELECT COUNT(*) as c FROM clients WHERE status='prospect'").get().c;
  const activeProjects = db.prepare("SELECT COUNT(*) as c FROM projects WHERE status='active'").get().c;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as r FROM invoices WHERE status='paid'").get().r;
  const pendingRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as r FROM invoices WHERE status='sent'").get().r;
  const overdueInvoices = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE status='overdue'").get().c;
  const overdueAmount = db.prepare("SELECT COALESCE(SUM(total),0) as r FROM invoices WHERE status='overdue'").get().r;
  const totalProjects = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;

  res.json({
    totalClients, activeClients, prospects,
    activeProjects, totalProjects,
    totalRevenue, pendingRevenue,
    overdueInvoices, overdueAmount
  });
});

app.get('/api/dashboard/revenue', (req, res) => {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    const rev = db.prepare(`
      SELECT COALESCE(SUM(total),0) as r FROM invoices
      WHERE status='paid' AND strftime('%Y-%m', paid_date) = ?
    `).get(`${y}-${m}`).r;
    months.push({ label, revenue: rev });
  }
  res.json(months);
});

app.get('/api/dashboard/activity', (req, res) => {
  const rows = db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 15').all();
  res.json(rows);
});

app.get('/api/dashboard/client-distribution', (req, res) => {
  const active = db.prepare("SELECT COUNT(*) as c FROM clients WHERE status='active'").get().c;
  const inactive = db.prepare("SELECT COUNT(*) as c FROM clients WHERE status='inactive'").get().c;
  const prospect = db.prepare("SELECT COUNT(*) as c FROM clients WHERE status='prospect'").get().c;
  res.json({ active, inactive, prospect });
});

// ─── Clients ──────────────────────────────────────────────────────────────────

app.get('/api/clients', (req, res) => {
  const { search, status, tag } = req.query;
  let query = 'SELECT * FROM clients WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR company LIKE ? OR email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (tag) {
    query += ' AND tags LIKE ?';
    params.push(`%${tag}%`);
  }

  query += ' ORDER BY created_at DESC';
  const clients = db.prepare(query).all(...params);

  // Attach project/invoice counts
  const withCounts = clients.map(c => {
    const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects WHERE client_id=?').get(c.id).c;
    const invoiceCount = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE client_id=?').get(c.id).c;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as r FROM invoices WHERE client_id=? AND status='paid'").get(c.id).r;
    return { ...c, tags: JSON.parse(c.tags || '[]'), projectCount, invoiceCount, totalRevenue };
  });

  res.json(withCounts);
});

app.get('/api/clients/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const projects = db.prepare('SELECT * FROM projects WHERE client_id=? ORDER BY created_at DESC').all(client.id);
  const invoices = db.prepare('SELECT * FROM invoices WHERE client_id=? ORDER BY created_at DESC').all(client.id);
  const notes = db.prepare('SELECT * FROM client_notes WHERE client_id=? ORDER BY created_at DESC').all(client.id);
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as r FROM invoices WHERE client_id=? AND status='paid'").get(client.id).r;

  res.json({
    ...client,
    tags: JSON.parse(client.tags || '[]'),
    projects,
    invoices: invoices.map(i => ({ ...i, items: JSON.parse(i.items || '[]') })),
    notes,
    totalRevenue
  });
});

app.post('/api/clients', (req, res) => {
  const { name, company, email, phone, address, status, tags, avatar_color } = req.body;
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];
  const color = avatar_color || colors[Math.floor(Math.random() * colors.length)];

  const result = db.prepare(`
    INSERT INTO clients (name, company, email, phone, address, status, tags, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, company || null, email || null, phone || null, address || null,
         status || 'active', JSON.stringify(tags || []), color);

  logActivity('client_created', 'New client added',
    `${name}${company ? ' from ' + company : ''} was added`, 'client', result.lastInsertRowid);

  const client = db.prepare('SELECT * FROM clients WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json({ ...client, tags: JSON.parse(client.tags) });
});

app.put('/api/clients/:id', (req, res) => {
  const { name, company, email, phone, address, status, tags, avatar_color } = req.body;
  const existing = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client not found' });

  db.prepare(`
    UPDATE clients SET name=?, company=?, email=?, phone=?, address=?, status=?, tags=?, avatar_color=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name || existing.name, company ?? existing.company, email ?? existing.email,
         phone ?? existing.phone, address ?? existing.address, status || existing.status,
         JSON.stringify(tags || JSON.parse(existing.tags)), avatar_color || existing.avatar_color,
         req.params.id);

  logActivity('client_updated', 'Client updated', `${name || existing.name} profile was updated`, 'client', req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
  res.json({ ...client, tags: JSON.parse(client.tags) });
});

app.delete('/api/clients/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  db.prepare('DELETE FROM clients WHERE id=?').run(req.params.id);
  logActivity('client_deleted', 'Client removed', `${client.name} was removed from the system`, 'client', req.params.id);
  res.json({ success: true });
});

// ─── Notes ────────────────────────────────────────────────────────────────────

app.get('/api/clients/:id/notes', (req, res) => {
  const notes = db.prepare('SELECT * FROM client_notes WHERE client_id=? ORDER BY created_at DESC').all(req.params.id);
  res.json(notes);
});

app.post('/api/clients/:id/notes', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const result = db.prepare('INSERT INTO client_notes (client_id, content) VALUES (?, ?)').run(req.params.id, req.body.content);
  db.prepare("UPDATE clients SET notes_count=notes_count+1, updated_at=datetime('now') WHERE id=?").run(req.params.id);
  logActivity('note_added', 'Note added', `Note added for ${client.name}`, 'client', req.params.id);

  res.status(201).json(db.prepare('SELECT * FROM client_notes WHERE id=?').get(result.lastInsertRowid));
});

app.delete('/api/notes/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM client_notes WHERE id=?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  db.prepare('DELETE FROM client_notes WHERE id=?').run(req.params.id);
  db.prepare("UPDATE clients SET notes_count=MAX(0,notes_count-1), updated_at=datetime('now') WHERE id=?").run(note.client_id);
  res.json({ success: true });
});

// ─── Projects ─────────────────────────────────────────────────────────────────

app.get('/api/projects', (req, res) => {
  const { client_id, status } = req.query;
  let query = `SELECT p.*, c.name as client_name, c.company as client_company, c.avatar_color
               FROM projects p LEFT JOIN clients c ON p.client_id=c.id WHERE 1=1`;
  const params = [];
  if (client_id) { query += ' AND p.client_id=?'; params.push(client_id); }
  if (status) { query += ' AND p.status=?'; params.push(status); }
  query += ' ORDER BY p.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/projects/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, c.name as client_name, c.company as client_company, c.avatar_color
    FROM projects p LEFT JOIN clients c ON p.client_id=c.id WHERE p.id=?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json(p);
});

app.post('/api/projects', (req, res) => {
  const { client_id, name, description, status, budget, spent, deadline, progress } = req.body;
  const result = db.prepare(`
    INSERT INTO projects (client_id, name, description, status, budget, spent, deadline, progress)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(client_id, name, description || null, status || 'planning',
         budget || 0, spent || 0, deadline || null, progress || 0);

  const client = db.prepare('SELECT name FROM clients WHERE id=?').get(client_id);
  logActivity('project_created', 'New project created',
    `${name} created for ${client?.name || 'Unknown'}`, 'project', result.lastInsertRowid);

  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id=?').get(result.lastInsertRowid));
});

app.put('/api/projects/:id', (req, res) => {
  const ex = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Project not found' });
  const { name, description, status, budget, spent, deadline, progress } = req.body;

  db.prepare(`
    UPDATE projects SET name=?, description=?, status=?, budget=?, spent=?, deadline=?, progress=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name||ex.name, description??ex.description, status||ex.status,
         budget??ex.budget, spent??ex.spent, deadline??ex.deadline, progress??ex.progress, req.params.id);

  if (status === 'completed') {
    logActivity('project_completed', 'Project completed', `${name||ex.name} marked as completed`, 'project', req.params.id);
  } else {
    logActivity('project_updated', 'Project updated', `${name||ex.name} was updated`, 'project', req.params.id);
  }

  res.json(db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id));
});

app.delete('/api/projects/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  logActivity('project_deleted', 'Project removed', `${p.name} was deleted`, 'project', req.params.id);
  res.json({ success: true });
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

app.get('/api/invoices', (req, res) => {
  const { client_id, status } = req.query;
  let query = `SELECT i.*, c.name as client_name, c.company as client_company, c.avatar_color
               FROM invoices i LEFT JOIN clients c ON i.client_id=c.id WHERE 1=1`;
  const params = [];
  if (client_id) { query += ' AND i.client_id=?'; params.push(client_id); }
  if (status) { query += ' AND i.status=?'; params.push(status); }
  query += ' ORDER BY i.created_at DESC';
  const rows = db.prepare(query).all(...params);
  res.json(rows.map(r => ({ ...r, items: JSON.parse(r.items || '[]') })));
});

app.get('/api/invoices/:id', (req, res) => {
  const inv = db.prepare(`SELECT i.*, c.name as client_name, c.company as client_company, c.email as client_email, c.address as client_address
    FROM invoices i LEFT JOIN clients c ON i.client_id=c.id WHERE i.id=?`).get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ ...inv, items: JSON.parse(inv.items || '[]') });
});

app.post('/api/invoices', (req, res) => {
  const { client_id, project_id, status, items, tax, due_date, notes } = req.body;

  // Generate invoice number
  const count = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c;
  const invoice_no = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

  const subtotal = (items || []).reduce((sum, i) => sum + (i.qty * i.rate), 0);
  const taxAmount = subtotal * ((tax || 0) / 100);
  const total = subtotal + taxAmount;

  const result = db.prepare(`
    INSERT INTO invoices (client_id, project_id, invoice_no, status, items, subtotal, tax, total, due_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(client_id, project_id || null, invoice_no, status || 'draft',
         JSON.stringify(items || []), subtotal, taxAmount, total, due_date || null, notes || null);

  const client = db.prepare('SELECT name FROM clients WHERE id=?').get(client_id);
  logActivity('invoice_created', 'Invoice created',
    `${invoice_no} created for ${client?.name} — $${total.toLocaleString()}`, 'invoice', result.lastInsertRowid);

  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json({ ...inv, items: JSON.parse(inv.items) });
});

app.put('/api/invoices/:id', (req, res) => {
  const ex = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Invoice not found' });

  const { status, items, tax, due_date, paid_date, notes, client_id, project_id } = req.body;
  const useItems = items || JSON.parse(ex.items);
  const useTaxRate = tax !== undefined ? tax : null;
  const subtotal = useItems.reduce((sum, i) => sum + (i.qty * i.rate), 0);
  const taxAmount = useTaxRate !== null ? subtotal * (useTaxRate / 100) : ex.tax;
  const total = subtotal + taxAmount;

  const newPaidDate = status === 'paid' ? (paid_date || new Date().toISOString().split('T')[0]) : (paid_date ?? ex.paid_date);

  db.prepare(`
    UPDATE invoices SET client_id=?, project_id=?, status=?, items=?, subtotal=?, tax=?, total=?, due_date=?, paid_date=?, notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(client_id||ex.client_id, project_id??ex.project_id, status||ex.status,
         JSON.stringify(useItems), subtotal, taxAmount, total,
         due_date??ex.due_date, newPaidDate, notes??ex.notes, req.params.id);

  if (status === 'paid' && ex.status !== 'paid') {
    logActivity('invoice_paid', 'Invoice paid', `${ex.invoice_no} — $${total.toLocaleString()} received`, 'invoice', req.params.id);
  } else if (status === 'sent' && ex.status !== 'sent') {
    logActivity('invoice_sent', 'Invoice sent', `${ex.invoice_no} sent to client`, 'invoice', req.params.id);
  }

  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  res.json({ ...inv, items: JSON.parse(inv.items) });
});

app.delete('/api/invoices/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  db.prepare('DELETE FROM invoices WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── Catch-all → SPA ─────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Client Management System running at http://localhost:${PORT}\n`);
});
