(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  // 画面の言語（assets/i18n.js が html[lang] を切り替える）に合わせて文言を選ぶ
  const MESSAGES = {
    ja: {
      mailOpened: 'メールアプリを開きました。内容をご確認のうえ送信してください。',
      failed: '送信できませんでした。',
      sending: '送信しています。',
      sendingButton: '送信中…',
      sent: '送信しました。受付完了メールをご確認ください。',
      retry: '時間をおいて再度お試しください。',
      submit: '送信する',
      subject: (name) => `Webサイトからのお問い合わせ：${name}`,
      mailBody: (d) => [
        `お名前：${d.name}`,
        `会社名・団体名：${d.company || '未入力'}`,
        `返信先メールアドレス：${d.email}`,
        '',
        'お問い合わせ内容：',
        d.message
      ]
    },
    en: {
      mailOpened: 'Your email app is open. Please check the message and send it.',
      failed: 'We could not send your message.',
      sending: 'Sending…',
      sendingButton: 'Sending…',
      sent: 'Thank you. Your message was sent — please check your inbox for the confirmation email.',
      retry: 'Please try again in a little while.',
      submit: 'Send',
      subject: (name) => `Website enquiry: ${name}`,
      mailBody: (d) => [
        `Name: ${d.name}`,
        `Company or organisation: ${d.company || '-'}`,
        `Reply-to email: ${d.email}`,
        '',
        'Message:',
        d.message
      ]
    }
  };
  const t = () => MESSAGES[document.documentElement.lang === 'en' ? 'en' : 'ja'];

  const status = document.querySelector('#form-status');
  const button = document.querySelector('#submit-button');
  const startedAt = document.querySelector('#started-at');
  startedAt.value = String(Date.now());

  function openMailClient(data) {
    const subject = t().subject(data.name);
    const body = t().mailBody(data).join('\n');
    const mailto = `mailto:hiroyatoyoshima@toyoseeds.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    status.className = 'form-status is-success';
    status.textContent = t().mailOpened;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.className = 'form-status';

    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    data.privacy = document.querySelector('#privacy').checked;
    button.disabled = true;
    button.textContent = t().sendingButton;
    status.textContent = t().sending;

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
      if (!response.ok) throw new Error(result.message || t().failed);

      form.reset();
      startedAt.value = String(Date.now());
      status.className = 'form-status is-success';
      status.textContent = t().sent;
    } catch (error) {
      if (error instanceof TypeError) {
        openMailClient(data);
        return;
      }
      status.className = 'form-status is-error';
      status.textContent = `${error.message} ${t().retry}`;
    } finally {
      button.disabled = false;
      button.textContent = t().submit;
    }
  });
})();
