async function updatePatStatus() {
  const status = document.getElementById('pat-status');
  status.textContent = 'Checking personal access token status...';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'CHECK_GITHUB_PAT' });
    if (!result?.ok) {
      throw new Error(result?.error || 'Could not check the token status');
    }
    if (!result.configured) {
      status.textContent = 'No personal access token is configured.';
      return;
    }
    if (!result.valid) {
      status.textContent = result.expired
        ? 'A token is configured, but it is expired or invalid. Configure a new token.'
        : `A token is configured, but its validity could not be verified: ${result.error}`;
      return;
    }

    const expiration = result.expiration
      ? new Date(result.expiration)
      : null;
    if (expiration && !Number.isNaN(expiration.getTime()) && expiration <= new Date()) {
      status.textContent = `A token is configured and expired at ${expiration.toLocaleString('en-US')}.`;
      return;
    }

    const account = result.username ? ` (${result.username})` : '';
    const expiryText = expiration && !Number.isNaN(expiration.getTime())
      ? `Expires: ${expiration.toLocaleString('en-US')}`
      : 'Expiration information is unavailable.';
    status.textContent = `Token is configured and valid${account}. ${expiryText}`;
  } catch (error) {
    status.textContent = `Could not check token status: ${error.message}`;
  }
}

document.getElementById('save-github-pat').addEventListener('click', async () => {
  const input = document.getElementById('github-pat');
  const status = document.getElementById('pat-status');
  const githubPat = input.value.trim();
  if (!githubPat) {
    status.textContent = 'Enter a personal access token.';
    return;
  }
  try {
    await chrome.storage.session.set({ githubPat });
    input.value = '';
    await updatePatStatus();
  } catch (error) {
    status.textContent = `Could not save the token: ${error.message}`;
  }
});

document.getElementById('clear-github-pat').addEventListener('click', async () => {
  const status = document.getElementById('pat-status');
  try {
    await chrome.storage.session.remove('githubPat');
    document.getElementById('github-pat').value = '';
    await updatePatStatus();
  } catch (error) {
    status.textContent = `Could not remove the token: ${error.message}`;
  }
});

updatePatStatus().catch((error) => {
  document.getElementById('pat-status').textContent =
    `Could not load token settings: ${error.message}`;
});
