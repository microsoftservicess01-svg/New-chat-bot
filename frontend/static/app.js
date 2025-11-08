// Change API and socket base URL
const API_BASE = "https://new-chat-bot-4.onrender.com"; // backend URL

// For Socket.IO connection:
const socket = io(API_BASE, { path: '/socket.io', autoConnect: false });

// Update API calls to use API_BASE
async function api(path, method='GET', body){
  const res = await fetch(API_BASE + '/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}
