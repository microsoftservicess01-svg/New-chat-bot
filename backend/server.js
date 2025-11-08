// === SIMPLE SIGNUP & LOGIN (PHONE + PASSWORD + ADMIN KEY) ===

// SIGNUP
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

// LOGIN
app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  const user = users[phone];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });
  const token = jwt.sign({ id: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ id: user.id, token });
});

