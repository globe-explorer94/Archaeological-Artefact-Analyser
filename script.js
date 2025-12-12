<!-- Replace existing <script src="https://accounts.google.com/gsi/client"></script> with Firebase -->
<script src="https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.11.0/firebase-auth-compat.js"></script>

<script>
  // 🔹 Firebase Config
  const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_FIREBASE_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_FIREBASE_PROJECT_ID",
    storageBucket: "YOUR_FIREBASE_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();

  let currentUser = null;

  // Simple email/password login
  async function signIn(email, password){
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      currentUser = userCredential.user;
      afterSignIn();
    } catch(e){
      alert(e.message);
    }
  }

  async function signUp(email, password){
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      currentUser = userCredential.user;
      afterSignIn();
    } catch(e){
      alert(e.message);
    }
  }

  function afterSignIn(){
    document.getElementById('signinBox').style.display = 'none';
    document.getElementById('profileArea').classList.remove('hidden');
    document.getElementById('profileName').innerText = currentUser.displayName || currentUser.email;
    document.getElementById('profileEmail').innerText = currentUser.email;
    document.getElementById('profilePic').src = currentUser.photoURL || 'https://www.gravatar.com/avatar/?d=mp';
    loadAnalyses();
  }

  auth.onAuthStateChanged(user => {
    if(user){
      currentUser = user;
      afterSignIn();
    }
  });

  async function onAnalyze(){
    if(!currentUser) return alert('Please sign in first.');
    const form = {
      location: document.getElementById('location').value,
      size: document.getElementById('size').value,
      material: document.getElementById('material').value,
      markings: document.getElementById('markings').value,
      age: document.getElementById('age').value,
      context: document.getElementById('context').value,
      notes: document.getElementById('notes').value
    };

    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('resultBox').classList.add('hidden');
    document.getElementById('analyzeBtn').disabled = true;

    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', email: currentUser.email, form, base64Image: lastBase64 })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || JSON.stringify(json));
      document.getElementById('resultBox').innerHTML = (json.aiText || '').replace(/\n/g,'<br>');
      document.getElementById('resultBox').classList.remove('hidden');
      loadAnalyses();
    } catch (err) {
      alert('Error: ' + (err.message || err));
    } finally {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('analyzeBtn').disabled = false;
    }
  }

  async function loadAnalyses(){
    if(!currentUser) return;
    const list = document.getElementById('analysesList');
    list.innerHTML = '<em>Loading…</em>';
    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getAnalyses', email: currentUser.email })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || JSON.stringify(json));
      const items = json.analyses || [];
      if (items.length === 0) { list.innerHTML = '<em>No analyses yet</em>'; return; }
      list.innerHTML = '';
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'analysis-item';
        div.innerHTML = `<div style="font-weight:700">${escapeHtml(item.location||'Unknown')}</div>
                         <div class="timestamp">${new Date(item.timestamp).toLocaleString()}</div>
                         <div style="margin-top:8px;color:var(--muted);font-size:13px">${escapeHtml((item.analysis||'').slice(0,120))}...</div>`;
        div.addEventListener('click', ()=> openAnalysis(item));
        list.appendChild(div);
      });
    } catch(err){
      list.innerHTML = '<em>Failed to load analyses.</em>';
      console.error(err);
    }
  }
</script>
