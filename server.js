/**
 * VLearn Tuition Centre — Backend v3 (PostgreSQL/Supabase)
 * NO better-sqlite3 · Uses pg only
 */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST","PUT","DELETE","PATCH"] } });

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "vlearn-santha-2026";

/* ─── POSTGRES ─── */
const DB_URL = process.env.DATABASE_URL ||
  "postgresql://postgres.kqtzeucpqvbscqammfaz:1TybLqe5ZztUpGGb@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  family: 4,
});
console.log("Connecting to:", DB_URL.split("@")[1]);

const q = (text, params) => pool.query(text, params);

/* ─── SETUP TABLES ─── */
async function setupDB() {
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL, pass TEXT NOT NULL, approved INTEGER DEFAULT 0,
      child_id TEXT, phone TEXT, created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, grade TEXT NOT NULL, subject TEXT NOT NULL,
      fee_status TEXT DEFAULT 'Pending', att INTEGER DEFAULT 0, parent_id TEXT,
      dob TEXT, joined TEXT, phone TEXT, email TEXT, parent_name TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY, student_id TEXT NOT NULL, date TEXT NOT NULL,
      status TEXT NOT NULL, marked_by TEXT, created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(student_id, date)
    );
    CREATE TABLE IF NOT EXISTS tests (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, name TEXT NOT NULL,
      marks INTEGER NOT NULL, total INTEGER NOT NULL, date TEXT NOT NULL,
      subject TEXT, remark TEXT, created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS fee_history (
      id SERIAL PRIMARY KEY, student_id TEXT NOT NULL, month TEXT NOT NULL,
      status TEXT NOT NULL, amt INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY, tag TEXT NOT NULL, text TEXT NOT NULL,
      date TEXT, posted_by TEXT, created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS fee_structure (
      grade TEXT NOT NULL, subject TEXT NOT NULL, amount INTEGER NOT NULL,
      PRIMARY KEY (grade, subject)
    );
    CREATE TABLE IF NOT EXISTS home_data (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY, url TEXT NOT NULL, caption TEXT, created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS enquiries (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
      grade TEXT, subject TEXT, message TEXT, status TEXT DEFAULT 'new', notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("✅ Tables ready");
}

/* ─── SEED ─── */
async function seed() {
  const { rows } = await q("SELECT COUNT(*) as c FROM users");
  const h = (p) => bcrypt.hashSync(p, 8);
  if (parseInt(rows[0].c) > 0) {
    await q("UPDATE users SET pass=$1,email=$2,name=$3 WHERE role='admin'",
      [h("181998"), "santha@123", "Santha (Admin)"]);
    return;
  }
  console.log("🌱 Seeding...");
  const iu = (vals) => q("INSERT INTO users (id,role,name,email,pass,approved,child_id,phone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING", vals);
  await iu(["a1","admin","Santha (Admin)","santha@123",h("181998"),1,null,"9113587199"]);
  await iu(["t1","teacher","Ravi Kumar","ravi@vlearn.in",h("teach123"),1,null,"9800001111"]);
  await iu(["p1","parent","Ramesh Sharma","ramesh@gmail.com",h("parent123"),1,"s1","9845001234"]);

  const is = (v) => q("INSERT INTO students (id,name,grade,subject,fee_status,att,parent_id,dob,joined,phone,parent_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING", v);
  await is(["s1","Aarav Sharma","Class 5","Mathematics","Paid",92,"p1","2014-03-12","Jan 2024","9845001234","Ramesh Sharma"]);
  await is(["s2","Priya Nair","Class 8","Science","Paid",87,null,"2011-07-22","Feb 2024","9845002345","Sunita Nair"]);
  await is(["s3","Riya Mehta","Class 3","English","Pending",78,null,"2016-11-05","Mar 2024","9845003456","Priya Mehta"]);

  const feeStruct = [["LKG","All Subjects",1200],["UKG","All Subjects",1200],["Class 1","All Subjects",1300],["Class 2","All Subjects",1300],["Class 3","All Subjects",1400],["Class 3","English",750],["Class 4","All Subjects",1400],["Class 5","All Subjects",1500],["Class 5","Mathematics",1000],["Class 6","All Subjects",1600],["Class 7","All Subjects",1700],["Class 8","All Subjects",1800],["Class 8","Science",1100],["Class 9","All Subjects",2000],["Class 9","Maths+Science",2000],["Class 10","All Subjects",2200],["Class 10","Maths+Science",2200]];
  for (const f of feeStruct) await q("INSERT INTO fee_structure (grade,subject,amount) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", f);

  const homeRows = [
    ["heroTitle","Building Strong Foundations"],["heroSubtitle","for Bright Futures 🌟"],
    ["heroDesc","Quality tuition for LKG to 10th Std — All subjects, individual attention, regular tests & personalized guidance."],
    ["phone","9113587199"],["timings","Mon–Sat: 8:00 AM – 5:00 PM"],
    ["mapAddress","#578, 11th Cross, 7th Main, Vinayaka Layout, Nagharbhavi, Blr-72"],
    ["schedule","[]"],
    ["features",JSON.stringify([{icon:"📚",title:"All Subjects",desc:"LKG to 10th Std"},{icon:"👤",title:"Individual Attention",desc:"Small batches"},{icon:"📋",title:"Regular Tests",desc:"Weekly evaluation"},{icon:"💡",title:"Personal Guidance",desc:"Custom plans"},{icon:"📈",title:"Improved Performance",desc:"Monthly tracking"},{icon:"😊",title:"Friendly Environment",desc:"Safe & positive space"}])],
  ];
  for (const [k,v] of homeRows) await q("INSERT INTO home_data (key,value) VALUES ($1,$2) ON CONFLICT DO NOTHING", [k,v]);

  await q("INSERT INTO notices (id,tag,text,date) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",["n1","General","Welcome to V Learn Tuition Centre!","Today"]);
  console.log("✅ Seed done. Admin: santha@123 / 181998");
}

/* ─── MIDDLEWARE ─── */
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
};
const adminOnly = (req, res, next) => req.user?.role === "admin" ? next() : res.status(403).json({ error: "Admin only" });
const staff = (req, res, next) => ["admin","teacher"].includes(req.user?.role) ? next() : res.status(403).json({ error: "Staff only" });

/* ─── HELPERS ─── */
async function buildStudent(s) {
  if (!s) return null;
  const [tests, feeHistory, attendance, parentRow] = await Promise.all([
    q("SELECT * FROM tests WHERE student_id=$1 ORDER BY created_at DESC", [s.id]),
    q("SELECT * FROM fee_history WHERE student_id=$1 ORDER BY id DESC", [s.id]),
    q("SELECT * FROM attendance WHERE student_id=$1 ORDER BY date DESC", [s.id]),
    s.parent_id ? q("SELECT id,name,email,phone FROM users WHERE id=$1", [s.parent_id]) : null,
  ]);
  return {
    ...s,
    feeStatus: s.fee_status,
    tests: tests.rows,
    feeHistory: feeHistory.rows,
    attendance: attendance.rows,
    parentUser: parentRow?.rows[0] || null,
  };
}

async function buildFeeStruct() {
  const { rows } = await q("SELECT grade, subject, amount FROM fee_structure");
  const out = {};
  for (const { grade, subject, amount } of rows) {
    if (!out[grade]) out[grade] = {};
    out[grade][subject] = amount;
  }
  return out;
}

async function buildHome() {
  const { rows } = await q("SELECT key, value FROM home_data");
  const data = {};
  for (const { key, value } of rows)
    try { data[key] = JSON.parse(value); } catch { data[key] = value; }
  const imgs = await q("SELECT * FROM gallery ORDER BY created_at");
  data.images = imgs.rows;
  return data;
}

const todayStr = () => new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });

/* ═══ AUTH ═══ */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, pass } = req.body;
    const { rows } = await q("SELECT * FROM users WHERE email=$1", [email?.trim()]);
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "Account not found" });
    if (!bcrypt.compareSync(pass, u.pass)) return res.status(401).json({ error: "Incorrect password" });
    if (!u.approved) return res.status(403).json({ error: "PENDING_APPROVAL" });
    const token = jwt.sign({ id:u.id, role:u.role, name:u.name, email:u.email, childId:u.child_id }, JWT_SECRET, { expiresIn:"30d" });
    res.json({ token, user: { id:u.id, role:u.role, name:u.name, email:u.email, childId:u.child_id } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, pass, role, phone } = req.body;
    const id = "u" + Date.now();
    const allowedRole = ["teacher","parent"].includes(role) ? role : "parent";
    await q("INSERT INTO users (id,role,name,email,pass,approved,phone) VALUES ($1,$2,$3,$4,$5,0,$6)",
      [id, allowedRole, name, email?.trim(), bcrypt.hashSync(pass, 8), phone||""]);
    io.emit("users_updated");
    res.json({ success:true, message:"Registered! Awaiting admin approval." });
  } catch(e) {
    if (e.message.includes("unique") || e.message.includes("duplicate")) return res.status(409).json({ error:"Email already registered" });
    res.status(500).json({ error: e.message });
  }
});

/* ═══ STUDENTS ═══ */
app.get("/api/students", auth, async (req, res) => {
  try {
    const { rows } = await q("SELECT * FROM students ORDER BY name");
    res.json(await Promise.all(rows.map(buildStudent)));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/students/:id", auth, async (req, res) => {
  try {
    const { rows } = await q("SELECT * FROM students WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    if (req.user.role === "parent" && rows[0].id !== req.user.childId) return res.status(403).json({ error: "Access denied" });
    res.json(await buildStudent(rows[0]));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/students", auth, staff, async (req, res) => {
  try {
    const { name, grade, subject, parentName, phone, email, dob, parent_id } = req.body;
    const id = "s" + Date.now();
    const joined = new Date().toLocaleDateString("en-IN", { month:"short", year:"numeric" });
    await q("INSERT INTO students (id,name,grade,subject,fee_status,att,phone,email,dob,joined,parent_name,parent_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [id, name, grade, subject, "Pending", 0, phone||"", email||"", dob||"", joined, parentName||"", parent_id||null]);
    const { rows } = await q("SELECT * FROM students WHERE id=$1", [id]);
    const s = await buildStudent(rows[0]);
    io.emit("student_added", s);
    res.json(s);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/students/:id", auth, staff, async (req, res) => {
  try {
    const { name, grade, subject, fee_status, phone, email, dob, parent_name, parent_id } = req.body;
    await q(`UPDATE students SET name=COALESCE($1,name),grade=COALESCE($2,grade),subject=COALESCE($3,subject),
      fee_status=COALESCE($4,fee_status),phone=COALESCE($5,phone),email=COALESCE($6,email),
      dob=COALESCE($7,dob),parent_name=COALESCE($8,parent_name),parent_id=$9 WHERE id=$10`,
      [name,grade,subject,fee_status,phone,email,dob,parent_name,parent_id||null,req.params.id]);
    const { rows } = await q("SELECT * FROM students WHERE id=$1", [req.params.id]);
    const s = await buildStudent(rows[0]);
    io.emit("student_updated", s);
    res.json(s);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/students/:id", auth, staff, async (req, res) => {
  try {
    await q("DELETE FROM attendance WHERE student_id=$1", [req.params.id]);
    await q("DELETE FROM tests WHERE student_id=$1", [req.params.id]);
    await q("DELETE FROM fee_history WHERE student_id=$1", [req.params.id]);
    await q("DELETE FROM students WHERE id=$1", [req.params.id]);
    io.emit("student_deleted", { id: req.params.id });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/students/:id/link-parent", auth, adminOnly, async (req, res) => {
  try {
    const { parent_id } = req.body;
    const old = (await q("SELECT parent_id FROM students WHERE id=$1", [req.params.id])).rows[0];
    if (old?.parent_id) await q("UPDATE users SET child_id=NULL WHERE id=$1", [old.parent_id]);
    if (parent_id) await q("UPDATE students SET parent_id=NULL WHERE parent_id=$1 AND id!=$2", [parent_id, req.params.id]);
    await q("UPDATE students SET parent_id=$1 WHERE id=$2", [parent_id||null, req.params.id]);
    if (parent_id) await q("UPDATE users SET child_id=$1 WHERE id=$2", [req.params.id, parent_id]);
    const { rows } = await q("SELECT * FROM students WHERE id=$1", [req.params.id]);
    const s = await buildStudent(rows[0]);
    io.emit("student_updated", s);
    io.emit("users_updated");
    res.json(s);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ ATTENDANCE ═══ */
app.get("/api/attendance", auth, async (req, res) => {
  try {
    const { date, student_id } = req.query;
    let text = "SELECT * FROM attendance WHERE 1=1"; const p = [];
    if (date) { text += ` AND date=$${p.length+1}`; p.push(date); }
    if (student_id) { text += ` AND student_id=$${p.length+1}`; p.push(student_id); }
    res.json((await q(text + " ORDER BY date DESC", p)).rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/attendance", auth, staff, async (req, res) => {
  try {
    const { records } = req.body;
    for (const r of records)
      await q("INSERT INTO attendance (student_id,date,status,marked_by) VALUES ($1,$2,$3,$4) ON CONFLICT (student_id,date) DO UPDATE SET status=$3, marked_by=$4",
        [r.student_id, r.date, r.status, req.user.name]);
    for (const id of [...new Set(records.map(r => r.student_id))])
      await q(`UPDATE students SET att=(SELECT ROUND(100.0*SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)/COUNT(*)) FROM attendance WHERE student_id=$1) WHERE id=$1`, [id]);
    io.emit("attendance_marked", { records, markedBy: req.user.name, date: records[0]?.date });
    res.json({ success:true, count: records.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ TESTS ═══ */
app.get("/api/tests", auth, async (req, res) => {
  try {
    const { student_id } = req.query;
    const text = student_id ? "SELECT * FROM tests WHERE student_id=$1 ORDER BY created_at DESC" : "SELECT * FROM tests ORDER BY created_at DESC";
    const params = student_id ? [student_id] : [];
    res.json((await q(text, params)).rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/tests", auth, staff, async (req, res) => {
  try {
    const { student_id, name, marks, total, date, subject, remark } = req.body;
    const id = "t" + Date.now();
    await q("INSERT INTO tests (id,student_id,name,marks,total,date,subject,remark) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, student_id, name, marks, total, date, subject, remark]);
    const test = (await q("SELECT * FROM tests WHERE id=$1", [id])).rows[0];
    const stu = (await q("SELECT id,name,parent_id FROM students WHERE id=$1", [student_id])).rows[0];
    io.emit("marks_added", { test, student: stu });
    res.json(test);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/tests/:id", auth, staff, async (req, res) => {
  try {
    await q("DELETE FROM tests WHERE id=$1", [req.params.id]);
    io.emit("marks_deleted", { id: req.params.id });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ FEES ═══ */
app.put("/api/students/:id/fee", auth, staff, async (req, res) => {
  try {
    const { fee_status } = req.body;
    await q("UPDATE students SET fee_status=$1 WHERE id=$2", [fee_status, req.params.id]);
    const s = (await q("SELECT * FROM students WHERE id=$1", [req.params.id])).rows[0];
    io.emit("fee_updated", { student_id: req.params.id, fee_status, feeStatus: fee_status, name: s?.name });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/fee-structure", async (req, res) => {
  try { res.json(await buildFeeStruct()); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/fee-structure", auth, adminOnly, async (req, res) => {
  try {
    const { structure } = req.body;
    for (const [g, ss] of Object.entries(structure))
      for (const [s, a] of Object.entries(ss))
        if (a > 0) await q("INSERT INTO fee_structure (grade,subject,amount) VALUES ($1,$2,$3) ON CONFLICT (grade,subject) DO UPDATE SET amount=$3", [g,s,a]);
        else await q("DELETE FROM fee_structure WHERE grade=$1 AND subject=$2", [g,s]);
    const updated = await buildFeeStruct();
    io.emit("fee_structure_updated", updated);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ NOTICES ═══ */
app.get("/api/notices", async (req, res) => {
  try { res.json((await q("SELECT * FROM notices ORDER BY created_at DESC")).rows); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/notices", auth, staff, async (req, res) => {
  try {
    const { tag, text } = req.body;
    const id = "n" + Date.now();
    const date = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    await q("INSERT INTO notices (id,tag,text,date,posted_by) VALUES ($1,$2,$3,$4,$5)", [id,tag,text,date,req.user.name]);
    const n = (await q("SELECT * FROM notices WHERE id=$1", [id])).rows[0];
    io.emit("notice_posted", n);
    res.json(n);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/notices/:id", auth, staff, async (req, res) => {
  try {
    await q("DELETE FROM notices WHERE id=$1", [req.params.id]);
    io.emit("notice_deleted", { id: req.params.id });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ USERS ═══ */
app.get("/api/users", auth, staff, async (req, res) => {
  try {
    const { rows } = await q("SELECT id,role,name,email,approved,child_id,phone,created_at FROM users ORDER BY created_at DESC");
    res.json(rows.map(u => ({ ...u, approved: !!u.approved })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/users/:id/approve", auth, adminOnly, async (req, res) => {
  try {
    await q("UPDATE users SET approved=1 WHERE id=$1", [req.params.id]);
    io.emit("user_approved", { id: req.params.id });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const { name, email, phone, child_id } = req.body;
    await q("UPDATE users SET name=COALESCE($1,name),email=COALESCE($2,email),phone=COALESCE($3,phone),child_id=$4 WHERE id=$5",
      [name,email,phone,child_id||null,req.params.id]);
    io.emit("users_updated");
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const { rows } = await q("SELECT role FROM users WHERE id=$1", [req.params.id]);
    if (rows[0]?.role === "admin") return res.status(403).json({ error: "Cannot delete admin" });
    await q("DELETE FROM users WHERE id=$1", [req.params.id]);
    io.emit("user_deleted", { id: req.params.id });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ ENQUIRIES ═══ */
app.post("/api/enquiries", async (req, res) => {
  try {
    const { name, phone, email, grade, subject, message } = req.body;
    if (!name || !phone) return res.status(400).json({ error: "Name and phone required" });
    const id = "e" + Date.now();
    await q("INSERT INTO enquiries (id,name,phone,email,grade,subject,message,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, name, phone, email||"", grade||"", subject||"", message||"", "new"]);
    const enq = (await q("SELECT * FROM enquiries WHERE id=$1", [id])).rows[0];
    io.emit("enquiry_received", enq);
    res.json({ success:true, message:"Enquiry submitted! We will contact you shortly." });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/enquiries", auth, adminOnly, async (req, res) => {
  try { res.json((await q("SELECT * FROM enquiries ORDER BY created_at DESC")).rows); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/enquiries/:id", auth, adminOnly, async (req, res) => {
  try {
    const { status, notes } = req.body;
    await q("UPDATE enquiries SET status=COALESCE($1,status),notes=COALESCE($2,notes) WHERE id=$3", [status,notes,req.params.id]);
    res.json((await q("SELECT * FROM enquiries WHERE id=$1", [req.params.id])).rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/enquiries/:id", auth, adminOnly, async (req, res) => {
  try { await q("DELETE FROM enquiries WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ HOME CMS ═══ */
app.get("/api/home", async (req, res) => {
  try { res.json(await buildHome()); } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/home", auth, adminOnly, async (req, res) => {
  try {
    const { heroTitle, heroSubtitle, heroDesc, phone, timings, mapAddress, features, schedule, lat, lng } = req.body;
    const ups = [
      ["heroTitle",heroTitle],["heroSubtitle",heroSubtitle],["heroDesc",heroDesc],
      ["phone",phone],["timings",timings],["mapAddress",mapAddress],
      ["features", features !== undefined ? JSON.stringify(Array.isArray(features)?features:[]) : undefined],
      ["schedule", schedule !== undefined ? JSON.stringify(schedule) : undefined],
      ["lat", lat !== undefined ? String(lat) : undefined],
      ["lng", lng !== undefined ? String(lng) : undefined],
    ];
    for (const [k,v] of ups)
      if (v !== undefined)
        await q("INSERT INTO home_data (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2", [k,v]);
    const updated = await buildHome();
    io.emit("home_updated", updated);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/gallery", auth, adminOnly, async (req, res) => {
  try {
    const { url, caption } = req.body;
    const id = "i" + Date.now();
    await q("INSERT INTO gallery (id,url,caption) VALUES ($1,$2,$3)", [id,url,caption||"Image"]);
    io.emit("gallery_updated");
    res.json((await q("SELECT * FROM gallery WHERE id=$1",[id])).rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/gallery/:id", auth, adminOnly, async (req, res) => {
  try {
    await q("DELETE FROM gallery WHERE id=$1", [req.params.id]);
    io.emit("gallery_updated");
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ STATS ═══ */
app.get("/api/stats", auth, staff, async (req, res) => {
  try {
    const today = todayStr();
    const [total, present, avgAtt, newEnq, pendingU] = await Promise.all([
      q("SELECT COUNT(*) as c FROM students"),
      q("SELECT COUNT(*) as c FROM attendance WHERE date=$1 AND status='present'", [today]),
      q("SELECT ROUND(AVG(att)) as a FROM students"),
      q("SELECT COUNT(*) as c FROM enquiries WHERE status='new'"),
      q("SELECT COUNT(*) as c FROM users WHERE approved=0"),
    ]);
    res.json({
      totalStudents: parseInt(total.rows[0].c),
      todayPresent:  parseInt(present.rows[0].c),
      avgAtt:        parseInt(avgAtt.rows[0].a || 0),
      newEnquiries:  parseInt(newEnq.rows[0].c),
      pendingUsers:  parseInt(pendingU.rows[0].c),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/health", (req, res) => res.json({ status:"ok", uptime: process.uptime() }));

/* ═══ SOCKET ═══ */
io.on("connection", (socket) => {
  socket.on("identify", ({ userId, role }) => {
    socket.join(`role:${role}`);
    if (userId) socket.join(`user:${userId}`);
  });
});

/* ═══ START ═══ */
async function start() {
  try {
    await setupDB();
    await seed();
    server.listen(PORT, () => {
      console.log(`\n🚀 VLearn Backend → http://localhost:${PORT}`);
      console.log(`🔑 Admin: santha@123 / 181998\n`);
    });
  } catch(e) {
    console.error("❌ Startup failed:", e.message);
    process.exit(1);
  }
}
start();
