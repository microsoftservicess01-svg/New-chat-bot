require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(express.json());

// ✅ Allow frontend hosted on Render
app.use(cors({
  origin: ["https://new-chat-bot-4.onrender.com"],
  methods: ["GET", "POST"],
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // socket.io can accept all; secure behind JWT
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const ADMIN_KEY = process.env.ADMIN_KEY || 'adminkey';

const users = {}; // in-memory
const sockets = {};

// === API ROUTES ===

// Signup (assigns unique ID)
app.post('/api/signup', async (req, res) => {
  const { name, password, accessKey } = req.body;
  if (!name || !password || !accessKey) return res.status(400).json({ error: 'missing fields' });
  if (accessKey !== ADMIN_KEY) return res.status(403).json({ error: 'invalid access key' });
  const id = uuidv4();
  const hash = await bcrypt.hash(password, 10);
  users[id] = { id, name, passwordHash: hash };
  const token = jwt.sign({ id, name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ id, token });
});

// Login
app.post('/api/login', async (req, res) => {
  const { id, password } = req.body;
  const user = users[id];
  if (!user) return res.status(404).json({ error: 'not found' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'wrong password' });
  const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ id: user.id, token });
});

// Get user list (auth required)
app.get('/api/users', (req, res) => {
  const auth = req.headers.authorization?.split(' ')[1];
  try {
    if (!auth) return res.status(401).json({ error: 'no auth' });
    jwt.verify(auth, JWT_SECRET);
    const list = Object.values(users).map(u => ({ id: u.id, name: u.name }));
    res.json(list);
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
});

// === Socket.IO ===
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('auth', (token) => {
    try {
      const user = jwt.verify(token, JWT_SECRET);
      sockets[socket.id] = user.id;
      socket.join('public');
      socket.emit('auth-ok', { id: user.id, name: user.name });
    } catch {
      socket.emit('auth-fail');
      socket.disconnect(true);
    }
  });

  socket.on('public-message', (msg) => {
    io.to('public').emit('public-message', { from: sockets[socket.id], text: msg });
  });

  socket.on('private-signal', (data) => {
    const target = Object.keys(sockets).find(sid => sockets[sid] === data.to);
    if (target) io.to(target).emit('private-signal', { from: sockets[socket.id], payload: data.payload });
  });

  socket.on('disconnect', () => {
    delete sockets[socket.id];
  });
});

server.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
