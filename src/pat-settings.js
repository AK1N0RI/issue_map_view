async function updatePatStatus() {
  const { githubPat } = await chrome.storage.session.get('githubPat');
  document.getElementById('pat-status').textContent = githubPat
    ? 'PATをブラウザー／拡張機能のセッション中のみ保存しています。'
    : 'PATは未設定です。';
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
    status.textContent = 'PATをブラウザー／拡張機能のセッション中のみ保存しました。';
  } catch (error) {
    status.textContent = `PATを保存できませんでした: ${error.message}`;
  }
});

document.getElementById('clear-github-pat').addEventListener('click', async () => {
  const status = document.getElementById('pat-status');
  try {
    await chrome.storage.session.remove('githubPat');
    document.getElementById('github-pat').value = '';
    status.textContent = 'PATを削除しました。';
  } catch (error) {
    status.textContent = `PATを削除できませんでした: ${error.message}`;
  }
});

updatePatStatus().catch((error) => {
  document.getElementById('pat-status').textContent =
    `PAT設定を読み込めませんでした: ${error.message}`;
});
