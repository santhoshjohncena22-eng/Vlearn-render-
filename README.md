# 🎓 VLearn Tuition Centre — Full Stack App

## Architecture

```
┌─────────────────────┐        WebSocket + REST        ┌────────────────────┐
│   REACT FRONTEND    │ ◄──────────────────────────── │  EXPRESS BACKEND   │
│  (vlearn-frontend)  │                                │  (vlearn-backend)  │
│                     │                                │                    │
│  • Admin Portal     │                                │  • SQLite DB       │
│  • Teacher Portal   │    Real-time via Socket.io     │  • REST API        │
│  • Parent Portal    │ ◄──── attendance marked ─────  │  • JWT Auth        │
│                     │ ◄──── marks added ───────────  │  • Socket.io       │
│  Parent sees marks  │ ◄──── notice posted ─────────  │                    │
│  instantly! ⚡      │ ◄──── fee status updated ────  │                    │
└─────────────────────┘                                └────────────────────┘
```

## ⚡ Real-time Events

| Event | Who triggers | Who sees it instantly |
|-------|-------------|----------------------|
| Attendance marked | Teacher | Admin + Parents |
| Marks added | Teacher | Admin + Parents |
| Notice posted | Admin | Everyone |
| Fee paid | Admin | Parent |
| Student enrolled | Admin | All staff |
| Fee structure changed | Admin | Enquiry form |

---

## 🚀 Quick Start

### 1. Start the Backend

```bash
cd vlearn-backend
npm install
npm start
```

You should see:
```
🚀 VLearn Backend running on http://localhost:4000
📡 Socket.io real-time enabled
💾 SQLite database: vlearn.db

Default logins:
  Admin:   admin@vlearn.in / admin123
  Teacher: teacher@vlearn.in / teach123
  Parent:  parent1@vlearn.in / parent123
```

### 2. Start the Frontend

```bash
# In a new terminal:
cd vlearn-frontend
npm install
npm start
```

Opens at **http://localhost:3000**

---

## 🔑 Default Logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@vlearn.in | admin123 |
| Teacher | teacher@vlearn.in | teach123 |
| Parent 1 | parent1@vlearn.in | parent123 |
| Parent 2 | parent2@vlearn.in | parent456 |

---

## 📡 API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Register (pending approval) |

### Students
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/students | All students (with tests, attendance, fees) |
| POST | /api/students | Enrol new student |
| PUT | /api/students/:id | Update student |
| DELETE | /api/students/:id | Remove student |

### Attendance
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/attendance | Get attendance records |
| POST | /api/attendance | Mark bulk attendance (broadcasts live) |

### Marks / Tests
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/tests | All test results |
| POST | /api/tests | Add test marks (broadcasts live) |
| DELETE | /api/tests/:id | Delete test |

### Fees
| Method | Path | Description |
|--------|------|-------------|
| PUT | /api/students/:id/fee | Update fee status |
| GET | /api/fee-structure | Get fee structure |
| PUT | /api/fee-structure | Update fee structure |

### Notices
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/notices | All notices |
| POST | /api/notices | Post notice (broadcasts live) |
| DELETE | /api/notices/:id | Delete notice |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/users | All users |
| PUT | /api/users/:id/approve | Approve user |
| DELETE | /api/users/:id | Delete user |
| GET | /api/stats | Dashboard stats |

---

## 🌐 Production Deployment

### Backend (Railway / Render / DigitalOcean)

```bash
# Set environment variables:
PORT=4000
JWT_SECRET=your-secret-key-here
```

Deploy `vlearn-backend/` folder. Your backend URL will be something like:
`https://vlearn-api.railway.app`

### Frontend (Netlify / Vercel)

Create `.env` file in `vlearn-frontend/`:
```
REACT_APP_API_URL=https://vlearn-api.railway.app
```

Then:
```bash
npm run build
# Deploy the build/ folder to Netlify
```

---

## 📁 File Structure

```
vlearn-backend/
├── server.js          ← Express + Socket.io + SQLite server
├── package.json       ← Dependencies
└── vlearn.db          ← SQLite database (auto-created)

vlearn-frontend/
├── src/
│   ├── App.jsx        ← Full React app with API integration
│   ├── api.js         ← API client + Socket.io connector
│   └── index.js       ← React entry point
├── public/
│   ├── index.html
│   └── manifest.json
└── package.json
```

---

## 🔧 How Real-time Works

1. **Teacher logs in** → Frontend connects to Socket.io
2. **Teacher marks attendance** → `POST /api/attendance`
3. **Backend saves to SQLite** → recalculates each student's att%
4. **Backend broadcasts** → `io.emit('attendance_marked', {...})`
5. **Parent's browser receives** → UI updates instantly, toast notification appears

No page refresh needed. Changes propagate in **< 100ms** on local network.

---

**VLearn Tuition Centre** | Tharika.P (B.Sc, B.Ed)  
📞 9113587199 | 📍 #578, 11th Cross, Nagharbhavi, Blr-72
