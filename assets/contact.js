(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const status = document.querySelector('#form-status');
  const button = document.querySelector('#submit-button');
  const startedAt = document.querySelector('#started-at');
  startedAt.value = String(Date.now());

  function openMailClient(data) {
    const subject = `Webサイトからのお問い合わせ：${data.name}`;
    const body = [
      `お名前：${data.name}`,
      `会社名・団体名：${data.company || '未入力'}`,
      `返信先メールアドレス：${data.email}`,
      '',
      'お問い合わせ内容：',
      data.message
    ].join('\n');
    const mailto = `mailto:hiroyatoyoshima@toyoseeds.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    status.className = 'form-status is-success';
    status.textContent = 'メールアプリを開きました。内容をご確認のうえ送信してください。';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.className = 'form-status';

    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    data.privacy = document.querySelector('#privacy').checked;
    button.disabled = true;
    button.textContent = '送信中…';
    status.textContent = '送信しています。';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 503) {
        openMailClient(data);
        return;
      }
      if (!response.ok) throw new Error(result.message || '送信できませんでした。');

      form.reset();
      startedAt.value = String(Date.now());
      status.className = 'form-status is-success';
      status.textContent = '送信しました。受付完了メールをご確認ください。';
    } catch (error) {
      if (error instanceof TypeError) {
        openMailClient(data);
        return;
      }
      status.className = 'form-status is-error';
      status.textContent = `${error.message} 時間をおいて再度お試しください。`;
    } finally {
      button.disabled = false;
      button.textContent = '送信する';
    }
  });
})();
