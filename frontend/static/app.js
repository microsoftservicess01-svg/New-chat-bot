// === CONFIG ===
const API_BASE = "https://new-chat-bot-4.onrender.com"; // backend Render URL
const socket = io(API_BASE, { path: '/socket.io', autoConnect: false });

let token = null;
let myId = null;

// === API HELPER ===
async function api(path, method = 'GET', body) {
  const res = await fetch(API_BASE + '/api/' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

// === DOM ===
const nameEl = document.getElementById('name');
const pwdEl = document.getElementById('password');
const accessKeyEl = document.getElementById('accessKey');
const signupBtn = document.getElementById('signup');
const loginBtn = document.getElementById('login');
const idLoginEl = document.getElementById('idLogin');
const meEl = document.getElementById('me');
const userListEl = document.getElementById('userList');
const publicChat = document.getElementById('publicChat');
const privateChat = document.getElementById('privateChat');
const publicInput = document.getElementById('publicInput');
const publicSend = document.getElementById('publicSend');
const privateInput = document.getElementById('privateInput');
const privateSend = document.getElementById('privateSend');
const callBtn = document.getElementById('callBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// === SIGNUP ===
signupBtn.onclick = async () => {
  const r = await api('signup', 'POST', {
    name: nameEl.value,
    password: pwdEl.value,
    accessKey: accessKeyEl.value
  });
  if (r.token) {
    token = r.token;
    myId = r.id;
    meEl.innerText = `ID: ${myId}`;
    startSocket();
    refreshUsers();
  } else alert(JSON.stringify(r));
};

// === LOGIN ===
loginBtn.onclick = async () => {
  const r = await api('login', 'POST', {
    id: idLoginEl.value,
    password: pwdEl.value
  });
  if (r.token) {
    token = r.token;
    myId = r.id;
    meEl.innerText = `ID: ${myId}`;
    startSocket();
    refreshUsers();
  } else alert(JSON.stringify(r));
};

// === USERS ===
async function refreshUsers() {
  const list = await api('users');
  userListEl.innerHTML = '';
  list.filter(u => u.id !== myId).forEach(u => {
    const o = document.createElement('option');
    o.value = u.id;
    o.textContent = `${u.name} (${u.id.slice(0, 6)})`;
    userListEl.appendChild(o);
  });
}

// === SOCKET.IO ===
function startSocket() {
  socket.connect();
  socket.on('connect', () => socket.emit('auth', token));
  socket.on('auth-ok', () => console.log('✅ Auth OK'));
  socket.on('public-message', m => {
    publicChat.innerHTML += `<div><b>${m.from}</b>: ${m.text}</div>`;
  });
  socket.on('private-signal', obj => handleSignal(obj.from, obj.payload));
}

// === CHAT ===
publicSend.onclick = () => {
  if (publicInput.value) {
    socket.emit('public-message', publicInput.value);
    publicInput.value = '';
  }
};

privateSend.onclick = () => {
  const to = userListEl.value;
  if (!to) return;
  socket.emit('private-signal', { to, payload: { type: 'msg', text: privateInput.value } });
  privateChat.innerHTML += `<div><b>me</b>: ${privateInput.value}</div>`;
  privateInput.value = '';
};

// === VIDEO ===
let pc, localStream;

callBtn.onclick = async () => {
  const to = userListEl.value;
  if (!to) return alert('Select user');
  await ensureLocalStream();
  pc = new RTCPeerConnection();
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = e => (remoteVideo.srcObject = e.streams[0]);
  pc.onicecandidate = e => {
    if (e.candidate)
      socket.emit('private-signal', { to, payload: { type: 'ice', candidate: e.candidate } });
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('private-signal', { to, payload: { type: 'offer', sdp: offer.sdp } });
};

async function handleSignal(from, payload) {
  if (payload.type === 'offer') {
    await ensureLocalStream();
    pc = new RTCPeerConnection();
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    pc.ontrack = e => (remoteVideo.srcObject = e.streams[0]);
    pc.onicecandidate = e => {
      if (e.candidate)
        socket.emit('private-signal', { to: from, payload: { type: 'ice', candidate: e.candidate } });
    };
    await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('private-signal', { to: from, payload: { type: 'answer', sdp: answer.sdp } });
  } else if (payload.type === 'answer') {
    await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
  } else if (payload.type === 'ice') {
    await pc.addIceCandidate(payload.candidate);
  } else if (payload.type === 'msg') {
    privateChat.innerHTML += `<div><b>${from}</b>: ${payload.text}</div>`;
  }
}

async function ensureLocalStream() {
  if (!localStream) localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}
