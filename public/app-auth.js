const API = 'https://intro-bgpstudioshou.replit.app';
let isLogin = true;

function toggleAuthMode() {
  isLogin = !isLogin;
  document.getElementById('auth-title').textContent = isLogin ? 'Sign In' : 'Create Account';
  document.getElementById('name').style.display = isLogin ? 'none' : 'block';
}

async function handleAuth() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const name = document.getElementById('name').value;

  if (!email || !password || (!isLogin && !name)) {
    alert("Please fill all fields");
    return;
  }

  try {
    let response;
    if (isLogin) {
      response = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password })
      });
    } else {
      response = await fetch(API + '/api/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, email, password, age: 28, bio: '' })
      });
    }

    const data = await response.json();
    if (data.token) {
      alert(isLogin ? "Welcome back!" : "Account created successfully!");
      document.getElementById('auth-screen').style.display = 'none';
      document.getElementById('main-screen').style.display = 'block';
    } else {
      alert(data.error || "Something went wrong");
    }
  } catch(e) {
    alert("Connection error. Is the backend running?");
  }
}

async function loadProfiles() {
  const result = document.getElementById('result');
  result.innerHTML = 'Loading thoughtful matches...';
  try {
    const res = await fetch(API + '/api/match/profiles');
    const data = await res.json();
    result.innerHTML = `<strong>Matches loaded:</strong><pre>` + JSON.stringify(data, null, 2) + '</pre>';
  } catch(e) {
    result.innerHTML = 'Error loading matches';
  }
}

async function createRoom(type) {
  const titles = { cafe: "Quiet Café", movie: "Movie Night", game: "Game Night" };
  const result = document.getElementById('result');
  result.innerHTML = `Creating ${titles[type]}...`;
  try {
    const res = await fetch(API + '/api/cafe/rooms', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ type, title: titles[type] })
    });
    const data = await res.json();
    result.innerHTML = `✅ ${titles[type]} room created!`;
  } catch(e) {
    result.innerHTML = 'Error creating room';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('signin-btn').addEventListener('click', handleAuth);
  document.getElementById('toggle-mode').addEventListener('click', toggleAuthMode);
  document.getElementById('load-profiles').addEventListener('click', loadProfiles);
  document.querySelectorAll('[data-room]').forEach((btn) => {
    btn.addEventListener('click', () => createRoom(btn.getAttribute('data-room')));
  });
});
