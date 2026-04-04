/**
 * VLearn Tuition Centre — Backend Server v2
 * Express + SQLite + Socket.io  |  Real-time across all portals
 */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Database = require("better-sqlite3");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST","PUT","DELETE","PATCH"] } });
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "vlearn-santha-2026";

/* ─── DATABASE ─── */
const db = new Database(path.join(__dirname, "vlearn.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, pass TEXT NOT NULL, approved INTEGER DEFAULT 0,
    child_id TEXT, phone TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, grade TEXT NOT NULL, subject TEXT NOT NULL,
    fee_status TEXT DEFAULT 'Pending', att INTEGER DEFAULT 0, parent_id TEXT,
    dob TEXT, joined TEXT, phone TEXT, email TEXT, parent_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    status TEXT NOT NULL, marked_by TEXT, created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(student_id, date)
  );
  CREATE TABLE IF NOT EXISTS tests (
    id TEXT PRIMARY KEY, student_id TEXT NOT NULL, name TEXT NOT NULL,
    marks INTEGER NOT NULL, total INTEGER NOT NULL, date TEXT NOT NULL,
    subject TEXT, remark TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS fee_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, month TEXT NOT NULL,
    status TEXT NOT NULL, amt INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY, tag TEXT NOT NULL, text TEXT NOT NULL,
    date TEXT DEFAULT (datetime('now')), posted_by TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS fee_structure (
    grade TEXT NOT NULL, subject TEXT NOT NULL, amount INTEGER NOT NULL, PRIMARY KEY (grade, subject)
  );
  CREATE TABLE IF NOT EXISTS home_data (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS gallery (
    id TEXT PRIMARY KEY, url TEXT NOT NULL, caption TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS enquiries (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
    grade TEXT, subject TEXT, message TEXT, status TEXT DEFAULT 'new', notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

/* ─── SEED ─── */
function seed() {
  const h = (p) => bcrypt.hashSync(p, 8);
  const cnt = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (cnt > 0) {
    // Always sync admin credentials
    db.prepare("UPDATE users SET pass=?,email=?,name=? WHERE role='admin'")
      .run(h("181998"), "santha@123", "Santha (Admin)");
    return;
  }
  console.log("🌱 Seeding...");
  const iu = db.prepare("INSERT OR IGNORE INTO users (id,role,name,email,pass,approved,child_id,phone) VALUES (?,?,?,?,?,?,?,?)");
  iu.run("a1","admin","Santha (Admin)","santha@123",h("181998"),1,null,"9113587199");
  iu.run("t1","teacher","Ravi Kumar","ravi@vlearn.in",h("teach123"),1,null,"9800001111");
  iu.run("p1","parent","Ramesh Sharma","ramesh@gmail.com",h("parent123"),1,"s1","9845001234");
  iu.run("p2","parent","Sunita Nair","sunita@gmail.com",h("parent456"),1,"s2","9845002345");

  const is = db.prepare("INSERT OR IGNORE INTO students (id,name,grade,subject,fee_status,att,parent_id,dob,joined,phone,parent_name) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  is.run("s1","Aarav Sharma","Class 5","Mathematics","Paid",92,"p1","2014-03-12","Jan 2024","9845001234","Ramesh Sharma");
  is.run("s2","Priya Nair","Class 8","Science","Paid",87,"p2","2011-07-22","Feb 2024","9845002345","Sunita Nair");
  is.run("s3","Riya Mehta","Class 3","English","Pending",78,null,"2016-11-05","Mar 2024","9845003456","Priya Mehta");
  is.run("s4","Karan Singh","LKG","All Subjects","Paid",95,null,"2019-01-18","Jan 2024","9845004567","Vijay Singh");
  is.run("s5","Sneha Rao","Class 10","Maths+Science","Overdue",65,null,"2009-09-30","Jun 2023","9845005678","Anand Rao");
  is.run("s6","Dev Patel","Class 7","Science","Paid",89,null,"2012-05-14","Aug 2023","9845006789","Mohan Patel");

  const it = db.prepare("INSERT OR IGNORE INTO tests (id,student_id,name,marks,total,date,subject,remark) VALUES (?,?,?,?,?,?,?,?)");
  [["t1","s1","Unit Test 1",88,100,"10 Mar 2026","Mathematics","Excellent work!"],
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
  ].forEach(r => it.run(...r));

  const if2 = db.prepare("INSERT OR IGNORE INTO fee_history (student_id,month,status,amt) VALUES (?,?,?,?)");
  [["s1","Apr","Paid",1000],["s1","Mar","Paid",1000],["s1","Feb","Paid",1000],
   ["s2","Apr","Paid",1100],["s2","Mar","Paid",1100],["s2","Feb","Pending",1100],
   ["s3","Apr","Pending",750],["s3","Mar","Paid",750],["s3","Feb","Paid",750],
   ["s4","Apr","Paid",1200],["s4","Mar","Paid",1200],["s4","Feb","Paid",1200],
   ["s5","Apr","Overdue",2200],["s5","Mar","Overdue",2200],["s5","Feb","Paid",2200],
   ["s6","Apr","Paid",1000],["s6","Mar","Paid",1000],["s6","Feb","Paid",1000],
  ].forEach(r => if2.run(...r));

  const in2 = db.prepare("INSERT OR IGNORE INTO notices (id,tag,text,date) VALUES (?,?,?,?)");
  in2.run("n1","Exam Alert","Unit test for Class 8–10 this Friday","2 days ago");
  in2.run("n2","Holiday","Centre closed Monday — Deepavali","4 days ago");
  in2.run("n3","Fee Reminder","Monthly fees due by 1st. Late charges apply.","1 week ago");
  in2.run("n4","New Batch","Class 9 new batch starts 10th April","2 weeks ago");

  const ifs = db.prepare("INSERT OR IGNORE INTO fee_structure (grade,subject,amount) VALUES (?,?,?)");
  const fd = {"LKG":{"All Subjects":1200},"UKG":{"All Subjects":1200},"Class 1":{"All Subjects":1300,"Mathematics":800,"English":700},"Class 2":{"All Subjects":1300,"Mathematics":800,"English":700},"Class 3":{"All Subjects":1400,"Mathematics":900,"English":750,"Science":850},"Class 4":{"All Subjects":1400,"Mathematics":900,"English":750,"Science":850},"Class 5":{"All Subjects":1500,"Mathematics":1000,"English":800,"Science":900},"Class 6":{"All Subjects":1600,"Mathematics":1000,"English":800,"Science":950},"Class 7":{"All Subjects":1700,"Mathematics":1100,"English":850,"Science":1000},"Class 8":{"All Subjects":1800,"Mathematics":1200,"English":900,"Science":1100,"Social Studies":800},"Class 9":{"All Subjects":2000,"Mathematics":1300,"Science":1200,"English":950,"Social Studies":850,"Maths+Science":2000},"Class 10":{"All Subjects":2200,"Mathematics":1400,"Science":1300,"English":1000,"Social Studies":900,"Maths+Science":2200}};
  for (const [g,ss] of Object.entries(fd)) for (const [s,a] of Object.entries(ss)) ifs.run(g,s,a);

  const ihd = db.prepare("INSERT OR IGNORE INTO home_data (key,value) VALUES (?,?)");
  ihd.run("heroTitle","Building Strong Foundations");
  ihd.run("heroSubtitle","for Bright Futures 🌟");
  ihd.run("heroDesc","Quality tuition for LKG to 10th Std — All subjects, individual attention, regular tests & personalized guidance.");
  ihd.run("phone","9113587199");
  ihd.run("timings","Mon–Sat: 8:00 AM – 5:00 PM");
  ihd.run("mapAddress","#578, 11th Cross, 7th Main, Vinayaka Layout, Nagharbhavi, Blr-72");
  ihd.run("features",JSON.stringify([{icon:"📚",title:"All Subjects",desc:"LKG to 10th Std covered"},{icon:"👤",title:"Individual Attention",desc:"Small batches, focused learning"},{icon:"📋",title:"Regular Tests",desc:"Weekly tests & evaluation"},{icon:"💡",title:"Personal Guidance",desc:"Custom plans per student"},{icon:"📈",title:"Improved Performance",desc:"Track progress every month"},{icon:"😊",title:"Friendly Environment",desc:"Safe & positive learning space"}]));

  const ig = db.prepare("INSERT OR IGNORE INTO gallery (id,url,caption) VALUES (?,?,?)");
  ig.run("i1","https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&q=80","Our Classroom");
  ig.run("i2","https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80","Study Sessions");
  ig.run("i3","https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&q=80","Learning Together");

  db.prepare("INSERT OR IGNORE INTO enquiries (id,name,phone,email,grade,subject,message,status) VALUES (?,?,?,?,?,?,?,?)")
    .run("e1","Sample Enquiry","9876543210","sample@gmail.com","Class 5","Mathematics","Looking for maths tuition","new");

  console.log("✅ Seed done. Admin: santha@123 / 181998");
}
seed();

/* ─── MIDDLEWARE ─── */
app.use(cors());
app.use(express.json());

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
};
const adminOnly = (req, res, next) => req.user?.role === "admin" ? next() : res.status(403).json({ error: "Admin only" });
const staff = (req, res, next) => ["admin","teacher"].includes(req.user?.role) ? next() : res.status(403).json({ error: "Staff only" });

/* ─── HELPERS ─── */
const buildStudent = (s) => {
  if (!s) return null;
  return {
    ...s,
    tests: db.prepare("SELECT * FROM tests WHERE student_id=? ORDER BY created_at DESC").all(s.id),
    feeHistory: db.prepare("SELECT * FROM fee_history WHERE student_id=? ORDER BY rowid DESC").all(s.id),
    attendance: db.prepare("SELECT * FROM attendance WHERE student_id=? ORDER BY date DESC").all(s.id),
    parentUser: s.parent_id ? db.prepare("SELECT id,name,email,phone FROM users WHERE id=?").get(s.parent_id) : null,
  };
};
const buildFeeStruct = () => {
  const out = {};
  for (const { grade, subject, amount } of db.prepare("SELECT * FROM fee_structure").all()) {
    if (!out[grade]) out[grade] = {};
    out[grade][subject] = amount;
  }
  return out;
};
const buildHome = () => {
  const data = {};
  for (const { key, value } of db.prepare("SELECT * FROM home_data").all())
    try { data[key] = JSON.parse(value); } catch { data[key] = value; }
  data.images = db.prepare("SELECT * FROM gallery ORDER BY created_at").all();
  return data;
};

/* ═══ AUTH ═══ */
app.post("/api/auth/login", (req, res) => {
  const { email, pass } = req.body;
  if (!email || !pass) return res.status(400).json({ error: "Email and password required" });
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(email.trim());
  if (!u) return res.status(401).json({ error: "Account not found" });
  if (!bcrypt.compareSync(pass, u.pass)) return res.status(401).json({ error: "Incorrect password" });
  if (!u.approved) return res.status(403).json({ error: "PENDING_APPROVAL" });
  const token = jwt.sign({ id: u.id, role: u.role, name: u.name, email: u.email, childId: u.child_id }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: u.id, role: u.role, name: u.name, email: u.email, childId: u.child_id } });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, pass, role, phone } = req.body;
  if (!name || !email || !pass) return res.status(400).json({ error: "Name, email and password required" });
  const id = "u" + Date.now();
  const allowedRole = ["teacher","parent"].includes(role) ? role : "parent";
  try {
    db.prepare("INSERT INTO users (id,role,name,email,pass,approved,phone) VALUES (?,?,?,?,?,0,?)")
      .run(id, allowedRole, name, email.trim(), bcrypt.hashSync(pass, 8), phone||"");
    io.emit("users_updated");
    res.json({ success: true, message: "Registered! Awaiting admin approval." });
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: e.message });
  }
});

/* ═══ STUDENTS ═══ */
app.get("/api/students", auth, (req, res) =>
  res.json(db.prepare("SELECT * FROM students ORDER BY name").all().map(buildStudent))
);
app.get("/api/students/:id", auth, (req, res) => {
  const s = db.prepare("SELECT * FROM students WHERE id=?").get(req.params.id);
  if (!s) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "parent" && s.id !== req.user.childId) return res.status(403).json({ error: "Access denied" });
  res.json(buildStudent(s));
});
app.post("/api/students", auth, staff, (req, res) => {
  const { name, grade, subject, parentName, phone, email, dob, parent_id } = req.body;
  if (!name || !grade || !subject) return res.status(400).json({ error: "Name, grade and subject required" });
  const id = "s" + Date.now();
  const joined = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  db.prepare("INSERT INTO students (id,name,grade,subject,fee_status,att,phone,email,dob,joined,parent_name,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, name, grade, subject, "Pending", 0, phone||"", email||"", dob||"", joined, parentName||"", parent_id||null);
  const s = buildStudent(db.prepare("SELECT * FROM students WHERE id=?").get(id));
  io.emit("student_added", s);
  res.json(s);
});
app.put("/api/students/:id", auth, staff, (req, res) => {
  const { name, grade, subject, fee_status, phone, email, dob, parent_name, parent_id } = req.body;
  db.prepare("UPDATE students SET name=COALESCE(?,name),grade=COALESCE(?,grade),subject=COALESCE(?,subject),fee_status=COALESCE(?,fee_status),phone=COALESCE(?,phone),email=COALESCE(?,email),dob=COALESCE(?,dob),parent_name=COALESCE(?,parent_name),parent_id=? WHERE id=?")
    .run(name,grade,subject,fee_status,phone,email,dob,parent_name,parent_id||null,req.params.id);
  const s = buildStudent(db.prepare("SELECT * FROM students WHERE id=?").get(req.params.id));
  io.emit("student_updated", s);
  res.json(s);
});
app.delete("/api/students/:id", auth, staff, (req, res) => {
  db.prepare("DELETE FROM students WHERE id=?").run(req.params.id);
  db.prepare("DELETE FROM attendance WHERE student_id=?").run(req.params.id);
  db.prepare("DELETE FROM tests WHERE student_id=?").run(req.params.id);
  db.prepare("DELETE FROM fee_history WHERE student_id=?").run(req.params.id);
  io.emit("student_deleted", { id: req.params.id });
  res.json({ success: true });
});
// Admin: link parent account to student
app.patch("/api/students/:id/link-parent", auth, adminOnly, (req, res) => {
  const { parent_id } = req.body;
  db.prepare("UPDATE students SET parent_id=? WHERE id=?").run(parent_id||null, req.params.id);
  if (parent_id) db.prepare("UPDATE users SET child_id=? WHERE id=?").run(req.params.id, parent_id);
  const s = buildStudent(db.prepare("SELECT * FROM students WHERE id=?").get(req.params.id));
  io.emit("student_updated", s);
  res.json(s);
});

/* ═══ ATTENDANCE ═══ */
app.get("/api/attendance", auth, (req, res) => {
  const { date, student_id } = req.query;
  let q = "SELECT * FROM attendance WHERE 1=1"; const p = [];
  if (date) { q += " AND date=?"; p.push(date); }
  if (student_id) { q += " AND student_id=?"; p.push(student_id); }
  res.json(db.prepare(q + " ORDER BY date DESC").all(...p));
});
app.post("/api/attendance", auth, staff, (req, res) => {
  const { records } = req.body;
  if (!records?.length) return res.status(400).json({ error: "No records" });
  const ins = db.prepare("INSERT OR REPLACE INTO attendance (student_id,date,status,marked_by) VALUES (?,?,?,?)");
  db.transaction(() => records.forEach(r => ins.run(r.student_id, r.date, r.status, req.user.name)))();
  const updAtt = db.prepare("UPDATE students SET att=(SELECT ROUND(100.0*SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)/COUNT(*)) FROM attendance WHERE student_id=students.id) WHERE id=?");
  [...new Set(records.map(r => r.student_id))].forEach(id => updAtt.run(id));
  io.emit("attendance_marked", { records, markedBy: req.user.name, date: records[0]?.date });
  res.json({ success: true, count: records.length });
});

/* ═══ TESTS ═══ */
app.get("/api/tests", auth, (req, res) => {
  const { student_id } = req.query;
  if (student_id) return res.json(db.prepare("SELECT * FROM tests WHERE student_id=? ORDER BY created_at DESC").all(student_id));
  res.json(db.prepare("SELECT * FROM tests ORDER BY created_at DESC").all());
});
app.post("/api/tests", auth, staff, (req, res) => {
  const { student_id, name, marks, total, date, subject, remark } = req.body;
  if (!student_id || !name || marks == null || !total) return res.status(400).json({ error: "Missing fields" });
  const id = "t" + Date.now();
  db.prepare("INSERT INTO tests (id,student_id,name,marks,total,date,subject,remark) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, student_id, name, marks, total, date, subject, remark);
  const test = db.prepare("SELECT * FROM tests WHERE id=?").get(id);
  const stu = db.prepare("SELECT id,name,parent_id FROM students WHERE id=?").get(student_id);
  io.emit("marks_added", { test, student: stu });
  res.json(test);
});
app.delete("/api/tests/:id", auth, staff, (req, res) => {
  db.prepare("DELETE FROM tests WHERE id=?").run(req.params.id);
  io.emit("marks_deleted", { id: req.params.id });
  res.json({ success: true });
});

/* ═══ FEES ═══ */
app.put("/api/students/:id/fee", auth, staff, (req, res) => {
  const { fee_status } = req.body;
  db.prepare("UPDATE students SET fee_status=? WHERE id=?").run(fee_status, req.params.id);
  const s = db.prepare("SELECT * FROM students WHERE id=?").get(req.params.id);
  io.emit("fee_updated", { student_id: req.params.id, fee_status, name: s?.name });
  res.json({ success: true });
});
app.get("/api/fee-structure", (req, res) => res.json(buildFeeStruct()));
app.put("/api/fee-structure", auth, adminOnly, (req, res) => {
  const { structure } = req.body;
  const ups = db.prepare("INSERT OR REPLACE INTO fee_structure (grade,subject,amount) VALUES (?,?,?)");
  const del = db.prepare("DELETE FROM fee_structure WHERE grade=? AND subject=?");
  db.transaction(() => {
    for (const [g, ss] of Object.entries(structure))
      for (const [s, a] of Object.entries(ss))
        a > 0 ? ups.run(g,s,a) : del.run(g,s);
  })();
  const updated = buildFeeStruct();
  io.emit("fee_structure_updated", updated);
  res.json(updated);
});

/* ═══ NOTICES ═══ */
app.get("/api/notices", (req, res) =>
  res.json(db.prepare("SELECT * FROM notices ORDER BY created_at DESC").all())
);
app.post("/api/notices", auth, staff, (req, res) => {
  const { tag, text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Message required" });
  const id = "n" + Date.now();
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  db.prepare("INSERT INTO notices (id,tag,text,date,posted_by) VALUES (?,?,?,?,?)").run(id,tag,text,date,req.user.name);
  const n = db.prepare("SELECT * FROM notices WHERE id=?").get(id);
  io.emit("notice_posted", n);
  res.json(n);
});
app.delete("/api/notices/:id", auth, staff, (req, res) => {
  db.prepare("DELETE FROM notices WHERE id=?").run(req.params.id);
  io.emit("notice_deleted", { id: req.params.id });
  res.json({ success: true });
});

/* ═══ USERS ═══ */
app.get("/api/users", auth, staff, (req, res) =>
  res.json(db.prepare("SELECT id,role,name,email,approved,child_id,phone,created_at FROM users ORDER BY created_at DESC").all().map(u => ({ ...u, approved: !!u.approved })))
);
app.put("/api/users/:id/approve", auth, adminOnly, (req, res) => {
  db.prepare("UPDATE users SET approved=1 WHERE id=?").run(req.params.id);
  io.emit("user_approved", { id: req.params.id });
  res.json({ success: true });
});
app.put("/api/users/:id", auth, adminOnly, (req, res) => {
  const { name, email, phone, child_id } = req.body;
  db.prepare("UPDATE users SET name=COALESCE(?,name),email=COALESCE(?,email),phone=COALESCE(?,phone),child_id=? WHERE id=?")
    .run(name,email,phone,child_id||null,req.params.id);
  io.emit("users_updated");
  res.json({ success: true });
});
app.delete("/api/users/:id", auth, adminOnly, (req, res) => {
  if (db.prepare("SELECT role FROM users WHERE id=?").get(req.params.id)?.role === "admin")
    return res.status(403).json({ error: "Cannot delete admin" });
  db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);
  io.emit("user_deleted", { id: req.params.id });
  res.json({ success: true });
});

/* ═══ ENQUIRIES ═══ */
app.post("/api/enquiries", (req, res) => {
  const { name, phone, email, grade, subject, message } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Name and phone required" });
  const id = "e" + Date.now();
  db.prepare("INSERT INTO enquiries (id,name,phone,email,grade,subject,message,status) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, name, phone, email||"", grade||"", subject||"", message||"", "new");
  const enq = db.prepare("SELECT * FROM enquiries WHERE id=?").get(id);
  io.emit("enquiry_received", enq);
  res.json({ success: true, message: "Enquiry submitted! We will contact you shortly." });
});
app.get("/api/enquiries", auth, adminOnly, (req, res) =>
  res.json(db.prepare("SELECT * FROM enquiries ORDER BY created_at DESC").all())
);
app.put("/api/enquiries/:id", auth, adminOnly, (req, res) => {
  const { status, notes } = req.body;
  db.prepare("UPDATE enquiries SET status=COALESCE(?,status),notes=COALESCE(?,notes) WHERE id=?")
    .run(status, notes, req.params.id);
  res.json(db.prepare("SELECT * FROM enquiries WHERE id=?").get(req.params.id));
});
app.delete("/api/enquiries/:id", auth, adminOnly, (req, res) => {
  db.prepare("DELETE FROM enquiries WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

/* ═══ HOME CMS ═══ */
app.get("/api/home", (req, res) => res.json(buildHome()));
app.put("/api/home", auth, adminOnly, (req, res) => {
  const ups = db.prepare("INSERT OR REPLACE INTO home_data (key,value) VALUES (?,?)");
  const { heroTitle, heroSubtitle, heroDesc, phone, timings, mapAddress, features } = req.body;
  db.transaction(() => {
    if (heroTitle !== undefined) ups.run("heroTitle", heroTitle);
    if (heroSubtitle !== undefined) ups.run("heroSubtitle", heroSubtitle);
    if (heroDesc !== undefined) ups.run("heroDesc", heroDesc);
    if (phone !== undefined) ups.run("phone", phone);
    if (timings !== undefined) ups.run("timings", timings);
    if (mapAddress !== undefined) ups.run("mapAddress", mapAddress);
    if (features !== undefined) ups.run("features", JSON.stringify(features));
  })();
  const updated = buildHome();
  io.emit("home_updated", updated);
  res.json(updated);
});
app.post("/api/gallery", auth, adminOnly, (req, res) => {
  const { url, caption } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });
  const id = "i" + Date.now();
  db.prepare("INSERT INTO gallery (id,url,caption) VALUES (?,?,?)").run(id, url, caption||"Image");
  io.emit("gallery_updated");
  res.json(db.prepare("SELECT * FROM gallery WHERE id=?").get(id));
});
app.delete("/api/gallery/:id", auth, adminOnly, (req, res) => {
  db.prepare("DELETE FROM gallery WHERE id=?").run(req.params.id);
  io.emit("gallery_updated");
  res.json({ success: true });
});

/* ═══ STATS ═══ */
app.get("/api/stats", auth, staff, (req, res) => {
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  res.json({
    totalStudents: db.prepare("SELECT COUNT(*) as c FROM students").get().c,
    todayPresent:  db.prepare("SELECT COUNT(*) as c FROM attendance WHERE date=? AND status='present'").get(today).c,
    avgAtt:        Math.round(db.prepare("SELECT AVG(att) as a FROM students").get().a || 0),
    newEnquiries:  db.prepare("SELECT COUNT(*) as c FROM enquiries WHERE status='new'").get().c,
    pendingUsers:  db.prepare("SELECT COUNT(*) as c FROM users WHERE approved=0").get().c,
  });
});

app.get("/api/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

io.on("connection", (socket) => {
  socket.on("identify", ({ userId, role }) => {
    socket.join(`role:${role}`);
    if (userId) socket.join(`user:${userId}`);
  });
  socket.on("ping", () => socket.emit("pong"));
});

server.listen(PORT, () => {
  console.log(`\n🚀 VLearn Backend  →  http://localhost:${PORT}`);
  console.log(`🔑 Admin login:  santha@123  /  181998\n`);
});
