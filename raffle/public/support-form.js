const form = document.getElementById('support-form');
const feedback = document.getElementById('support-status');
const submit = form.querySelector('button[type=submit]');
submit.disabled = false;

form.addEventListener('submit', async event => {
  event.preventDefault();
  submit.disabled = true;
  feedback.textContent = 'Sending report…';
  try {
    const response = await fetch('/support/report', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    feedback.textContent = 'Report received. Your reference is ' + result.id + '.';
    form.reset();
  } catch (error) {
    feedback.textContent = error.message || 'Unable to send your report. Try again or email Arcade support.';
  } finally {
    submit.disabled = false;
  }
});
