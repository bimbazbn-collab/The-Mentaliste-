// ===== The Mentalist (voce: Cyborg) - logica principale =====

const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const statusLine = document.getElementById('statusLine');

const settingsBtn = document.getElementById('settingsBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const closeSettings = document.getElementById('closeSettings');
const saveSettings = document.getElementById('saveSettings');
const apiKeyInput = document.getElementById('apiKey');
const voiceOutSelect = document.getElementById('voiceOut');

let history = []; // { role: 'user'|'assistant', content: '...' }

// ---------- Impostazioni salvate localmente sul dispositivo ----------
function loadSettings() {
  apiKeyInput.value = localStorage.getItem('jarvis_api_key') || '';
  voiceOutSelect.value = localStorage.getItem('jarvis_voice_out') || 'on';
}
function getApiKey() { return localStorage.getItem('jarvis_api_key') || ''; }
function voiceEnabled() { return (localStorage.getItem('jarvis_voice_out') || 'on') === 'on'; }

settingsBtn.addEventListener('click', () => {
  loadSettings();
  settingsOverlay.classList.add('open');
});
closeSettings.addEventListener('click', () => settingsOverlay.classList.remove('open'));
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) settingsOverlay.classList.remove('open');
});
saveSettings.addEventListener('click', () => {
  localStorage.setItem('jarvis_api_key', apiKeyInput.value.trim());
  localStorage.setItem('jarvis_voice_out', voiceOutSelect.value);
  settingsOverlay.classList.remove('open');
  statusLine.textContent = getApiKey() ? 'sistemi pronti' : 'manca la chiave API';
});

// ---------- Rendering messaggi ----------
function addMessage(role, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + (role === 'user' ? 'msg-user' : role === 'error' ? 'msg-error' : 'msg-assistant');
  const p = document.createElement('p');
  p.textContent = text;
  div.appendChild(p);
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'msg msg-assistant';
  div.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

// ---------- Invio messaggi a Claude ----------
async function sendToClaude(userText) {
  const apiKey = getApiKey();
  if (!apiKey) {
    addMessage('error', 'Manca la chiave API. Apri le impostazioni (⚙) e incollala.');
    settingsOverlay.classList.add('open');
    return;
  }

  history.push({ role: 'user', content: userText });
  const typingEl = addTypingIndicator();
  statusLine.textContent = 'sto pensando...';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'Sei Cyborg, un assistente personale utile, diretto e cordiale. Rispondi sempre in italiano, in modo chiaro e conciso.',
        messages: history
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Errore ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const testo = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    typingEl.remove();
    addMessage('assistant', testo);
    history.push({ role: 'assistant', content: testo });
    statusLine.textContent = 'sistemi pronti';

    if (voiceEnabled()) parla(testo);
  } catch (err) {
    typingEl.remove();
    addMessage('error', 'Non sono riuscito a rispondere. ' + err.message);
    statusLine.textContent = 'errore di connessione';
  }
}

// ---------- Invio dal composer ----------
function inviaMessaggio() {
  const testo = inputEl.value.trim();
  if (!testo) return;
  addMessage('user', testo);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendToClaude(testo);
}

sendBtn.addEventListener('click', inviaMessaggio);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    inviaMessaggio();
  }
});
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
});

// ---------- Voce in uscita (sintesi vocale) ----------
function parla(testo) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(testo);
  u.lang = 'it-IT';
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}

// ---------- Voce in entrata (riconoscimento vocale) ----------
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let ascoltando = false;

if (SpeechRecognitionAPI) {
  recognizer = new SpeechRecognitionAPI();
  recognizer.lang = 'it-IT';
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  recognizer.onresult = (event) => {
    const testo = event.results[0][0].transcript;
    inputEl.value = testo;
    inviaMessaggio();
  };
  recognizer.onerror = () => {
    statusLine.textContent = 'non ho capito, riprova';
    setTimeout(() => { statusLine.textContent = 'sistemi pronti'; }, 2000);
  };
  recognizer.onend = () => {
    ascoltando = false;
    micBtn.classList.remove('listening');
  };
} else {
  micBtn.style.opacity = '0.35';
}

micBtn.addEventListener('click', () => {
  if (!recognizer) {
    addMessage('error', 'Il riconoscimento vocale non è supportato da questo browser. Prova con Chrome.');
    return;
  }
  if (ascoltando) {
    recognizer.stop();
    return;
  }
  ascoltando = true;
  micBtn.classList.add('listening');
  statusLine.textContent = 'ti ascolto...';
  recognizer.start();
});

// ---------- Avvio ----------
loadSettings();
statusLine.textContent = getApiKey() ? 'sistemi pronti' : 'manca la chiave API';

// ---------- Service worker per installabilità offline ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
    }
