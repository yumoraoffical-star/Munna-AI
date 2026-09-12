(() => {
  const messages = document.querySelector('#messages');
  if (!messages) return;

  const addCopy = (bubble) => {
    if (!bubble || bubble.dataset.copyReady === '1' || !bubble.closest('.message.ai')) return;
    bubble.dataset.copyReady = '1';
    const wrap = bubble.closest('.ai-content');
    if (!wrap) return;
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const copy = document.createElement('button');
    copy.className = 'message-action';
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.setAttribute('aria-label', 'Copy response');
    copy.onclick = async () => {
      const text = bubble.textContent.trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = 'Copied';
        setTimeout(() => { copy.textContent = 'Copy'; }, 1400);
      } catch {
        window.toast?.('Copy nahi ho paaya.');
      }
    };
    actions.appendChild(copy);
    wrap.appendChild(actions);
  };

  const scan = () => messages.querySelectorAll('.message.ai .bubble').forEach(addCopy);
  new MutationObserver(scan).observe(messages, { childList: true, subtree: true });
  scan();
})();
