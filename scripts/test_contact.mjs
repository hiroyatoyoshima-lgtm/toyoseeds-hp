process.env.GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
process.env.CONTACT_SHARED_SECRET = 'test-shared-secret';

const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({url, options, body: JSON.parse(options.body)});
  return {ok: true, status: 200, json: async () => ({ok: true})};
};

const {default: handler} = await import('../api/contact.mjs?test=google');
const request = {
  method: 'POST',
  body: {
    name: '??? ??',
    company: '?????',
    email: 'sender@example.com',
    message: '???????????',
    privacy: true,
    website: '',
    startedAt: Date.now() - 5000
  }
};
const response = {
  statusCode: 200,
  headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; }
};

await handler(request, response);
if (response.statusCode !== 200 || !response.body?.ok) throw new Error('Handler did not return success');
if (calls.length !== 1) throw new Error('Expected one Apps Script request');
if (calls[0].url !== process.env.GOOGLE_APPS_SCRIPT_URL) throw new Error('Apps Script URL mismatch');
if (calls[0].body.secret !== process.env.CONTACT_SHARED_SECRET) throw new Error('Shared secret mismatch');
if (calls[0].body.email !== 'sender@example.com') throw new Error('Sender email mismatch');
console.log('Contact handler test passed: Gmail notification + auto-reply request');
