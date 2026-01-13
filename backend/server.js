const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 12000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Initialize database
const db = new Database(path.join(__dirname, 'budget.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    shooting_days INTEGER DEFAULT 1,
    include_hotel INTEGER DEFAULT 0,
    hotel_cost_per_night REAL DEFAULT 0,
    per_diem REAL DEFAULT 0,
    actual_per_diem REAL DEFAULT 0,
    archived INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT DEFAULT '',
    daily_rate REAL DEFAULT 0,
    flat_fee REAL DEFAULT 0,
    hotel_nights INTEGER DEFAULT 0,
    travel_costs REAL DEFAULT 0,
    days_on_set INTEGER DEFAULT NULL,
    costs REAL DEFAULT 0,
    color TEXT DEFAULT NULL,
    active INTEGER DEFAULT 1,
    actual_costs REAL DEFAULT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

// Add actual_per_diem column if it doesn't exist
try {
  db.exec(`ALTER TABLE projects ADD COLUMN actual_per_diem REAL DEFAULT 0`);
} catch (e) {
  // Column already exists
}

// Get all projects (non-archived)
app.get('/api/projects', (req, res) => {
  const archived = req.query.archived === 'true' ? 1 : 0;
  const projects = db.prepare('SELECT * FROM projects WHERE archived = ? ORDER BY updated_at DESC').all(archived);
  res.json(projects);
});

// Get single project with positions
app.get('/api/projects/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  const positions = db.prepare('SELECT * FROM positions WHERE project_id = ? ORDER BY sort_order ASC').all(req.params.id);
  res.json({ ...project, positions });
});

// Create new project
app.post('/api/projects', (req, res) => {
  const id = uuidv4();
  const { name = 'Neues Projekt' } = req.body;
  db.prepare(`
    INSERT INTO projects (id, name, shooting_days, include_hotel, hotel_cost_per_night, per_diem)
    VALUES (?, ?, 1, 0, 0, 0)
  `).run(id, name);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.json({ ...project, positions: [] });
});

// Update project
app.put('/api/projects/:id', (req, res) => {
  const { name, shooting_days, include_hotel, hotel_cost_per_night, per_diem, archived } = req.body;
  const updates = [];
  const values = [];
  
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (shooting_days !== undefined) { updates.push('shooting_days = ?'); values.push(shooting_days); }
  if (include_hotel !== undefined) { updates.push('include_hotel = ?'); values.push(include_hotel ? 1 : 0); }
  if (hotel_cost_per_night !== undefined) { updates.push('hotel_cost_per_night = ?'); values.push(hotel_cost_per_night); }
  if (per_diem !== undefined) { updates.push('per_diem = ?'); values.push(per_diem); }
  if (archived !== undefined) { updates.push('archived = ?'); values.push(archived ? 1 : 0); }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id);
  
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  const positions = db.prepare('SELECT * FROM positions WHERE project_id = ? ORDER BY sort_order ASC').all(req.params.id);
  res.json({ ...project, positions });
});

// Delete project
app.delete('/api/projects/:id', (req, res) => {
  db.prepare('DELETE FROM positions WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Add position to project
app.post('/api/projects/:id/positions', (req, res) => {
  const positionId = uuidv4();
  const { type = 'position' } = req.body;
  
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM positions WHERE project_id = ?').get(req.params.id);
  const sortOrder = (maxOrder.max || 0) + 1;
  
  db.prepare(`
    INSERT INTO positions (id, project_id, type, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(positionId, req.params.id, type, sortOrder);
  
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  
  const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
  res.json(position);
});

// Update position
app.put('/api/positions/:id', (req, res) => {
  const { name, daily_rate, flat_fee, hotel_nights, travel_costs, days_on_set, costs, color, active, actual_costs, sort_order } = req.body;
  const updates = [];
  const values = [];
  
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (daily_rate !== undefined) { updates.push('daily_rate = ?'); values.push(daily_rate); }
  if (flat_fee !== undefined) { updates.push('flat_fee = ?'); values.push(flat_fee); }
  if (hotel_nights !== undefined) { updates.push('hotel_nights = ?'); values.push(hotel_nights); }
  if (travel_costs !== undefined) { updates.push('travel_costs = ?'); values.push(travel_costs); }
  if (days_on_set !== undefined) { updates.push('days_on_set = ?'); values.push(days_on_set); }
  if (costs !== undefined) { updates.push('costs = ?'); values.push(costs); }
  if (color !== undefined) { updates.push('color = ?'); values.push(color); }
  if (active !== undefined) { updates.push('active = ?'); values.push(active ? 1 : 0); }
  if (actual_costs !== undefined) { updates.push('actual_costs = ?'); values.push(actual_costs); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
  
  if (updates.length === 0) {
    return res.json(db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id));
  }
  
  values.push(req.params.id);
  db.prepare(`UPDATE positions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
  if (position) {
    db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(position.project_id);
  }
  
  res.json(position);
});

// Delete position
app.delete('/api/positions/:id', (req, res) => {
  const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
  if (position) {
    db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(position.project_id);
  }
  db.prepare('DELETE FROM positions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Reorder positions
app.put('/api/projects/:id/reorder', (req, res) => {
  const { positions } = req.body;
  const stmt = db.prepare('UPDATE positions SET sort_order = ? WHERE id = ?');
  positions.forEach((pos, index) => {
    stmt.run(index, pos.id);
  });
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
