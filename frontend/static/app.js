// === Backend Render URL ===
const API_BASE = "https://new-chat-bot-4.onrender.com"; // your backend URL

// === Socket.IO connection ===
const socket = io(API_BASE, { path: '/socket.io', autoConnect: false });

// === Helper for all API calls ===
async function api(path, method='GET', body) {
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

// === CONFIG: Update this to your backend Render URL ===
const API_BASE = "https://new-chat-bot-4.onrender.com"; // <-- your backend URL

// === SOCKET.IO connection to backend ===
const socket = io(API_BASE, { path: '/socket.io', autoConnect: false });

// === API helper ===
async function api(path, method='GET', body) {
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
