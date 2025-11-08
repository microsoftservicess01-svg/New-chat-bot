// === Encrypted Chat Backend (Phone + Password + Admin Key) ===
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// === ENV CONFIG ===
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const ADMIN_KEY = process.env.ADMIN_KEY || "adminkey";

app.use(express.json());
app.use(cors());

// === In-memory store ===
const users = {};
const sockets = {};

// === SIGNUP ===
app.post('/api/signup', async (req, res) => {
  const { phone, password, accessKey } = req.body;
  if (!phone || !password || !accessKey) return res.status(400).json({ error: 'Missing fields' });
  if (accessKey !== ADMIN_KEY) return res.status(403).json({ error: 'Invalid admin key' });
  if (users[phone]) return res.status(400).json({ error: 'User already exists' });

  const hash = await bcrypt.hash(password, 10);
  users[phone] = { id: phone, phone, passwordHash: hash };
  const token = jwt.sign({ id: phone, phone }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ id: phone, token });
});

// === LOGIN ===
app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  const user = users[phone];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });
  const token = jwt.sign({ id: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ id: user.id, token });
});

// === USERS LIST ===
app.get('/api/users', (req, res) => {
  const auth = req.headers.authorization?.split(' ')[1];
  try {
    if (!auth) return res.status(401).json({ error: 'no auth' });
    jwt.verify(auth, JWT_SECRET);
    const publicUsers = Object.values(users).map(u => ({ id: u.id, phone: u.phone }));
    res.json(publicUsers);
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
});

// === SOCKET.IO SIGNALING ===
io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('auth', token => {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      sockets[socket.id] = payload.id;
      socket.join('public-broadcast');
      socket.emit('auth-ok', { id: payload.id });
    } catch {
      socket.emit('auth-fail');
      socket.disconnect(true);
    }
  });

  socket.on('public-message', msg => {
    io.to('public-broadcast').emit('public-message', { from: sockets[socket.id], text: msg });
  });

  socket.on('private-signal', obj => {
    const targetId = obj.to;
    const targetSocketId = Object.keys(sockets).find(sid => sockets[sid] === targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('private-signal', { from: sockets[socket.id], text: obj.payload });
    }
  });

  socket.on('disconnect', () => {
    delete sockets[socket.id];
    console.log('socket disconnected', socket.id);
  });
});

server.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
