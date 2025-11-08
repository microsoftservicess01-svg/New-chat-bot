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
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const ADMIN_KEY = process.env.ADMIN_KEY || 'adminkey';

const users = {};
const sockets = {};

app.post('/api/signup', async (req, res) => {
  const { name, password, accessKey } = req.body;
  if (!name || !password || !accessKey) return res.status(400).json({ error: 'missing' });
  if (accessKey !== ADMIN_KEY) return res.status(403).json({ error: 'invalid access key' });
  const id = uuidv4();
  const hash = await bcrypt.hash(password, 10);
  users[id] = { id, name, passwordHash: hash };
  const token = jwt.sign({ id, name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ id, token });
});

app.post('/api/login', async (req, res) => {
  const { id, password } = req.body;
  const u = users[id];
  if (!u) return res.status(404).json({ error: 'not found' });
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: 'bad creds' });
  const token = jwt.sign({ id: u.id, name: u.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ id: u.id, token });
});

app.get('/api/users', (req, res) => {
  const auth = req.headers.authorization?.split(' ')[1];
  try {
    if (!auth) return res.status(401).json({ error: 'no auth' });
    jwt.verify(auth, JWT_SECRET);
    const publicUsers = Object.values(users).map(u => ({ id: u.id, name: u.name }));
    res.json(publicUsers);
  } catch (e) {
    return res.status(401).json({ error: 'invalid' });
  }
});

io.on('connection', socket => {
  socket.on('auth', token => {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      sockets[socket.id] = payload.id;
      socket.join('public-broadcast');
      socket.emit('auth-ok', { id: payload.id, name: payload.name });
    } catch (e) {
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
    if (targetSocketId) io.to(targetSocketId).emit('private-signal', { from: sockets[socket.id], payload: obj.payload });
  });

  socket.on('disconnect', () => {
    delete sockets[socket.id];
  });
});

server.listen(PORT, () => console.log('Backend running on port', PORT));
