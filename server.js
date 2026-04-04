/**
 * VLearn Tuition Centre — Backend v3 (PostgreSQL / Supabase)
 * Express + pg + Socket.io | Admin: santha@123 / 181998
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

/* ─── POSTGRES CONNECTION ─── */
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres.kqtzeucpqvbscqammfaz:1TybLqe5ZztUpGGb@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  family: 4,
});
console.log('Connecting to:', DB_URL.split('@')[1]);

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
      date TEXT DEFAULT NOW()::TEXT, posted_by TEXT, created_at TIMESTAMP DEFAULT NOW()
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
  if (parseInt(rows[0].c) > 0) {
    const hash = bcrypt.hashSync("181998", 8);
    await q("UPDATE users SET pass=$1, email=$2, name=$3 WHERE role='admin'",
      [hash, "santha@123", "Santha (Admin)"]);
    return;
  }
  console.log("🌱 Seeding...");
  const h = (p) => bcrypt.hashSync(p, 8);

  await q("INSERT INTO users (id,role,name,email,pass,approved,child_id,phone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
    ["a1","admin","Santha (Admin)","santha@123",h("181998"),1,null,"9113587199"]);
  await q("INSERT INTO users (id,role,name,email,pass,approved,child_id,phone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
    ["t1","teacher","Ravi Kumar","ravi@vlearn.in",h("teach123"),1,null,"9800001111"]);
  await q("INSERT INTO users (id,role,name,email,pass,approved,child_id,phone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
    ["p1","parent","Ramesh Sharma","ramesh@gmail.com",h("parent123"),1,"s1","9845001234"]);
  await q("INSERT INTO users (id,role,name,email,pass,approved,child_id,phone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
    ["p2","parent","Sunita Nair","sunita@gmail.com",h("parent456"),1,"s2","9845002345"]);

  const students = [
    ["s1","Aarav Sharma","Class 5","Mathematics","Paid",92,"p1","2014-03-12","Jan 2024","9845001234","Ramesh Sharma"],
    ["s2","Priya Nair","Class 8","Science","Paid",87,"p2","2011-07-22","Feb 2024","9845002345","Sunita Nair"],
    ["s3","Riya Mehta","Class 3","English","Pending",78,null,"2016-11-05","Mar 2024","9845003456","Priya Mehta"],
    ["s4","Karan Singh","LKG","All Subjects","Paid",95,null,"2019-01-18","Jan 2024","9845004567","Vijay Singh"],
    ["s5","Sneha Rao","Class 10","Maths+Science","Overdue",65,null,"2009-09-30","Jun 2023","9845005678","Anand Rao"],
    ["s6","Dev Patel","Class 7","Science","Paid",89,null,"2012-05-14","Aug 2023","9845006789","Mohan Patel"],
  ];
  for (const s of students)
    await q("INSERT INTO students (id,name,grade,subject,fee_status,att,parent_id,dob,joined,phone,parent_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING", s);

  const tests = [
    ["t1","s1","Unit Test 1",88,100,"10 Mar 2026","Mathematics","Excellent work!"],
    ["t2","s1","Unit Test 2",74,100,"25 Mar 2026","Mathematics","Work on fractions"],
    ["t3","s2","Unit Test 1",91,100,"10 Mar 2026","Science","Outstanding!"],
    ["t4","s2","Unit Test 2",82,100,"25 Mar 2026","Science","Keep it up"],
    ["t5","s3","Unit Test 1",65,100,"10 Mar 2026","English","More reading practice"],
    ["t6","s3","Unit Test 2",70,100,"25 Mar 2026","English","Improving steadily"],
    ["t7","s4","Activity 1",95,100,"10 Mar 2026","All Subjects","Very active!"],
    ["t8","s4","Activity 2",90,100,"25 Mar 2026","All Subjects","Great participation"],
    ["t9","s5","Unit Test 1",55,100,"10 Mar 2026","Mathematics","Needs improvement"],
    ["t10","s5","Unit Test 2",60,100,"25 Mar 2026","Science","Focus on ch 4 & 5"],
    ["t11","s6","Unit Test 1",78,100,"10 Mar 2026","Science","Good understanding"],
    ["t12","s6","Unit Test 2",83,100,"25 Mar 2026","Science","Excellent progress!"],
  ];
  for (const t of tests)
    await q("INSERT INTO tests (id,student_id,name,marks,total,date,subject,remark) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING", t);

  const fees = [
    ["s1","Apr","Paid",1000],["s1","Mar","Paid",1000],["s1","Feb","Paid",1000],
    ["s2","Apr","Paid",1100],["s2","Mar","Paid",1100],["s2","Feb","Pending",1100],
    ["s3","Apr","Pending",750],["s3","Mar","Paid",750],["s3","Feb","Paid",750],
    ["s4","Apr","Paid",1200],["s4","Mar","Paid",1200],["s4","Feb","Paid",1200],
    ["s5","Apr","Overdue",2200],["s5","Mar","Overdue",2200],["s5","Feb","Paid",2200],
    ["s6","Apr","Paid",1000],["s6","Mar","Paid",1000],["s6","Feb","Paid",1000],
  ];
  for (const f of fees)
    await q("INSERT INTO fee_history (student_id,month,status,amt) VALUES ($1,$2,$3,$4)", f);

  await q("INSERT INTO notices (id,tag,text,date) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    ["n1","Exam Alert","Unit test for Class 8–10 this Friday","2 days ago"]);
  await q("INSERT INTO notices (id,tag,text,date) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    ["n2","Holiday","Centre closed Monday — Deepavali","4 days ago"]);
  await q("INSERT INTO notices (id,tag,text,date) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    ["n3","Fee Reminder","Monthly fees due by 1st. Late charges apply.","1 week ago"]);
  await q("INSERT INTO notices (id,tag,text,date) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    ["n4","New Batch","Class 9 new batch starts 10th April","2 weeks ago"]);

  const feeStruct = [
    ["LKG","All Subjects",1200],["UKG","All Subjects",1200],
    ["Class 1","All Subjects",1300],["Class 1","Mathematics",800],["Class 1","English",700],
    ["Class 2","All Subjects",1300],["Class 2","Mathematics",800],["Class 2","English",700],
    ["Class 3","All Subjects",1400],["Class 3","Mathematics",900],["Class 3","English",750],["Class 3","Science",850],
    ["Class 4","All Subjects",1400],["Class 4","Mathematics",900],["Class 4","English",750],["Class 4","Science",850],
    ["Class 5","All Subjects",1500],["Class 5","Mathematics",1000],["Class 5","English",800],["Class 5","Science",900],
    ["Class 6","All Subjects",1600],["Class 6","Mathematics",1000],["Class 6","English",800],["Class 6","Science",950],
    ["Class 7","All Subjects",1700],["Class 7","Mathematics",1100],["Class 7","English",850],["Class 7","Science",1000],
    ["Class 8","All Subjects",1800],["Class 8","Mathematics",1200],["Class 8","English",900],["Class 8","Science",1100],["Class 8","Social Studies",800],
    ["Class 9","All Subjects",2000],["Class 9","Mathematics",1300],["Class 9","Science",1200],["Class 9","English",950],["Class 9","Social Studies",850],["Class 9","Maths+Science",2000],
    ["Class 10","All Subjects",2200],["Class 10","Mathematics",1400],["Class 10","Science",1300],["Class 10","English",1000],["Class 10","Social Studies",900],["Class 10","Maths+Science",2200],
  ];
  for (const f of feeStruct)
    await q("INSERT INTO fee_structure (grade,subject,amount) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", f);

  const homeRows = [
    ["heroTitle","Building Strong Foundations"],
    ["heroSubtitle","for Bright Futures 🌟"],
    ["heroDesc","Quality tuition for LKG to 10th Std — All subjects, individual attention, regular tests & personalized guidance."],
    ["phone","9113587199"],
    ["timings","Mon–Sat: 8:00 AM – 5:00 PM"],
    ["mapAddress","#578, 11th Cross, 7th Main, Vinayaka Layout, Nagharbhavi, Blr-72"],
    ["features",JSON.stringify([{icon:"📚",title:"All Subjects",desc:"LKG to 10th Std"},{icon:"👤",title:"Individual Attention",desc:"Small batches"},{icon:"📋",title:"Regular Tests",desc:"Weekly evaluation"},{icon:"💡",title:"Personal Guidance",desc:"Custom plans"},{icon:"📈",title:"Improved Performance",desc:"Monthly tracking"},{icon:"😊",title:"Friendly Environment",desc:"Safe & positive space"}])],
  ];
  for (const [k,v] of homeRows)
    await q("INSERT INTO home_data (key,value) VALUES ($1,$2) ON CONFLICT DO NOTHING", [k,v]);

  const gallery = [
    ["i1","https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&q=80","Our Classroom"],
    ["i2","https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80","Study Sessions"],
    ["i3","https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&q=80","Learning Together"],
  ];
  for (const g of gallery)
    await q("INSERT INTO gallery (id,url,caption) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", g);

  await q("INSERT INTO enquiries (id,name,phone,email,grade,subject,message,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
    ["e1","Sample Enquiry","9876543210","sample@gmail.com","Class 5","Mathematics","Looking for maths tuition","new"]);

  console.log("✅ Seed done. Admin: santha@123 / 181998");
}

/* ─── MIDDLEWARE ─── */
app.use(cors());
app.use(express.json());

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
    if (!email || !pass) return res.status(400).json({ error: "Email and password required" });
    const { rows } = await q("SELECT * FROM users WHERE email=$1", [email.trim()]);
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
    if (!name || !email || !pass) return res.status(400).json({ error: "Name, email and password required" });
    const id = "u" + Date.now();
    const allowedRole = ["teacher","parent"].includes(role) ? role : "parent";
    await q("INSERT INTO users (id,role,name,email,pass,approved,phone) VALUES ($1,$2,$3,$4,$5,0,$6)",
      [id, allowedRole, name, email.trim(), bcrypt.hashSync(pass, 8), phone||""]);
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
    const students = await Promise.all(rows.map(buildStudent));
    res.json(students);
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
    if (!name || !grade || !subject) return res.status(400).json({ error: "Name, grade and subject required" });
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
    await q(`UPDATE students SET
      name=COALESCE($1,name), grade=COALESCE($2,grade), subject=COALESCE($3,subject),
      fee_status=COALESCE($4,fee_status), phone=COALESCE($5,phone), email=COALESCE($6,email),
      dob=COALESCE($7,dob), parent_name=COALESCE($8,parent_name), parent_id=$9
      WHERE id=$10`,
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
    await q("UPDATE students SET parent_id=$1 WHERE id=$2", [parent_id||null, req.params.id]);
    if (parent_id) await q("UPDATE users SET child_id=$1 WHERE id=$2", [req.params.id, parent_id]);
    const { rows } = await q("SELECT * FROM students WHERE id=$1", [req.params.id]);
    const s = await buildStudent(rows[0]);
    io.emit("student_updated", s);
    res.json(s);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ ATTENDANCE ═══ */
app.get("/api/attendance", auth, async (req, res) => {
  try {
    const { date, student_id } = req.query;
    let text = "SELECT * FROM attendance WHERE 1=1"; const params = [];
    if (date) { text += ` AND date=$${params.length+1}`; params.push(date); }
    if (student_id) { text += ` AND student_id=$${params.length+1}`; params.push(student_id); }
    const { rows } = await q(text + " ORDER BY date DESC", params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/attendance", auth, staff, async (req, res) => {
  try {
    const { records } = req.body;
    if (!records?.length) return res.status(400).json({ error: "No records" });
    for (const r of records)
      await q("INSERT INTO attendance (student_id,date,status,marked_by) VALUES ($1,$2,$3,$4) ON CONFLICT (student_id,date) DO UPDATE SET status=$3, marked_by=$4",
        [r.student_id, r.date, r.status, req.user.name]);
    // Recalculate attendance %
    const ids = [...new Set(records.map(r => r.student_id))];
    for (const id of ids)
      await q(`UPDATE students SET att=(
        SELECT ROUND(100.0 * SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) / COUNT(*))
        FROM attendance WHERE student_id=$1
      ) WHERE id=$1`, [id]);
    io.emit("attendance_marked", { records, markedBy: req.user.name, date: records[0]?.date });
    res.json({ success:true, count: records.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ TESTS ═══ */
app.get("/api/tests", auth, async (req, res) => {
  try {
    const { student_id } = req.query;
    if (student_id) {
      const { rows } = await q("SELECT * FROM tests WHERE student_id=$1 ORDER BY created_at DESC", [student_id]);
      return res.json(rows);
    }
    const { rows } = await q("SELECT * FROM tests ORDER BY created_at DESC");
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/tests", auth, staff, async (req, res) => {
  try {
    const { student_id, name, marks, total, date, subject, remark } = req.body;
    if (!student_id || !name || marks == null || !total) return res.status(400).json({ error: "Missing fields" });
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
    io.emit("fee_updated", { student_id: req.params.id, fee_status, name: s?.name });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/fee-structure", async (req, res) => {
  try { res.json(await buildFeeStruct()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/fee-structure", auth, adminOnly, async (req, res) => {
  try {
    const { structure } = req.body;
    for (const [grade, subjects] of Object.entries(structure))
      for (const [subject, amount] of Object.entries(subjects))
        if (amount > 0)
          await q("INSERT INTO fee_structure (grade,subject,amount) VALUES ($1,$2,$3) ON CONFLICT (grade,subject) DO UPDATE SET amount=$3", [grade,subject,amount]);
        else
          await q("DELETE FROM fee_structure WHERE grade=$1 AND subject=$2", [grade,subject]);
    const updated = await buildFeeStruct();
    io.emit("fee_structure_updated", updated);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ NOTICES ═══ */
app.get("/api/notices", async (req, res) => {
  try {
    const { rows } = await q("SELECT * FROM notices ORDER BY created_at DESC");
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/notices", auth, staff, async (req, res) => {
  try {
    const { tag, text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message required" });
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
  try {
    const { rows } = await q("SELECT * FROM enquiries ORDER BY created_at DESC");
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/enquiries/:id", auth, adminOnly, async (req, res) => {
  try {
    const { status, notes } = req.body;
    await q("UPDATE enquiries SET status=COALESCE($1,status), notes=COALESCE($2,notes) WHERE id=$3", [status,notes,req.params.id]);
    const { rows } = await q("SELECT * FROM enquiries WHERE id=$1", [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/enquiries/:id", auth, adminOnly, async (req, res) => {
  try {
    await q("DELETE FROM enquiries WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ═══ HOME CMS ═══ */
app.get("/api/home", async (req, res) => {
  try { res.json(await buildHome()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/home", auth, adminOnly, async (req, res) => {
  try {
    const { heroTitle, heroSubtitle, heroDesc, phone, timings, mapAddress, features } = req.body;
    const ups = [
      ["heroTitle", heroTitle], ["heroSubtitle", heroSubtitle], ["heroDesc", heroDesc],
      ["phone", phone], ["timings", timings], ["mapAddress", mapAddress],
      ["features", features ? JSON.stringify(features) : undefined],
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
    if (!url) return res.status(400).json({ error: "URL required" });
    const id = "i" + Date.now();
    await q("INSERT INTO gallery (id,url,caption) VALUES ($1,$2,$3)", [id,url,caption||"Image"]);
    const img = (await q("SELECT * FROM gallery WHERE id=$1",[id])).rows[0];
    io.emit("gallery_updated");
    res.json(img);
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

/* ═══ SOCKET.IO ═══ */
io.on("connection", (socket) => {
  socket.on("identify", ({ userId, role }) => {
    socket.join(`role:${role}`);
    if (userId) socket.join(`user:${userId}`);
  });
  socket.on("ping", () => socket.emit("pong"));
});

/* ═══ START ═══ */
async function start() {
  try {
    await setupDB();
    await seed();
    server.listen(PORT, () => {
      console.log(`\n🚀 VLearn Backend  →  http://localhost:${PORT}`);
      console.log(`🔑 Admin: santha@123 / 181998\n`);
    });
  } catch(e) {
    console.error("❌ Startup failed:", e.message);
    process.exit(1);
  }
}
start();
