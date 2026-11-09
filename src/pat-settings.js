async function updatePatStatus() {
  const status = document.getElementById('pat-status');
  status.textContent = 'PATの設定状態を確認中...';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'CHECK_GITHUB_PAT' });
    if (!result?.ok) {
      throw new Error(result?.error || 'PATの状態を確認できませんでした');
    }
    if (!result.configured) {
      status.textContent = 'PATは未設定です。';
      return;
    }
    if (!result.valid) {
      status.textContent = result.expired
        ? 'PATは設定済みですが、期限切れまたは無効です。新しいPATを設定してください。'
        : `PATは設定済みですが、有効性を確認できませんでした: ${result.error}`;
      return;
    }

    const expiration = result.expiration
      ? new Date(result.expiration)
      : null;
    if (expiration && !Number.isNaN(expiration.getTime()) && expiration <= new Date()) {
      status.textContent = `PATは設定済みですが、${expiration.toLocaleString('ja-JP')} に期限切れです。`;
      return;
    }

    const account = result.username ? `（${result.username}）` : '';
    const expiryText = expiration && !Number.isNaN(expiration.getTime())
      ? `有効期限: ${expiration.toLocaleString('ja-JP')}`
      : '有効期限情報を取得できませんでした。';
    status.textContent = `PATは設定済み・有効です${account}。${expiryText}`;
  } catch (error) {
    status.textContent = `PATの状態を確認できませんでした: ${error.message}`;
  }
}

document.getElementById('save-github-pat').addEventListener('click', async () => {
  const input = document.getElementById('github-pat');
  const status = document.getElementById('pat-status');
  const githubPat = input.value.trim();
  if (!githubPat) {
    status.textContent = 'PATを入力してください。';
    return;
  }
  try {
    await chrome.storage.session.set({ githubPat });
    input.value = '';
    await updatePatStatus();
  } catch (error) {
    status.textContent = `PATを保存できませんでした: ${error.message}`;
  }
});

document.getElementById('clear-github-pat').addEventListener('click', async () => {
  const status = document.getElementById('pat-status');
  try {
    await chrome.storage.session.remove('githubPat');
    document.getElementById('github-pat').value = '';
    await updatePatStatus();
  } catch (error) {
    status.textContent = `PATを削除できませんでした: ${error.message}`;
  }
});

updatePatStatus().catch((error) => {
  document.getElementById('pat-status').textContent =
    `PAT設定を読み込めませんでした: ${error.message}`;
});
