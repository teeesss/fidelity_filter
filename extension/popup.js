/**
 * popup.js — Extension toolbar popup controller.
 * Queries the active tab for filter status and sends relaunch / close commands
 * to the content script via chrome.tabs.sendMessage.
 */

const statusBadge  = document.getElementById('status-badge');
const relaunchBtn  = document.getElementById('relaunch-btn');
const closeBtn     = document.getElementById('close-btn');
const feedback     = document.getElementById('feedback');

// ── Helpers ───────────────────────────────────────────────────────────────

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function showFeedback(msg, color = '#4ade80') {
  feedback.innerHTML =
    `<div class="flash" style="color:${color}">${msg}</div>`;
}

function setStatus(active) {
  statusBadge.textContent = active ? 'Active' : 'Inactive';
  statusBadge.className   = 'status-badge ' + (active ? 'active' : 'inactive');
}

// ── Check current filter state on open ───────────────────────────────────

(async () => {
  const tab = await getActiveTab();
  if (!tab) { setStatus(false); return; }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'status' });
    setStatus(response?.active === true);
  } catch {
    // Content script not running on this page (e.g. non-Fidelity tab)
    setStatus(false);
    relaunchBtn.disabled = true;
    relaunchBtn.style.opacity = '0.4';
    closeBtn.disabled = true;
    closeBtn.style.opacity = '0.4';
    showFeedback('Open a Fidelity Positions page first.', 'rgba(255,180,0,0.8)');
  }
})();

// ── Relaunch ──────────────────────────────────────────────────────────────

relaunchBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'relaunch' });
    setStatus(true);
    showFeedback('✓ Filter relaunched!');
    setTimeout(() => window.close(), 900);
  } catch {
    showFeedback('Could not reach the page.', '#f87171');
  }
});

// ── Close filter ─────────────────────────────────────────────────────────

closeBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'close' });
    setStatus(false);
    showFeedback('Filter closed.', 'rgba(255,255,255,0.4)');
    setTimeout(() => window.close(), 800);
  } catch {
    showFeedback('Could not reach the page.', '#f87171');
  }
});
