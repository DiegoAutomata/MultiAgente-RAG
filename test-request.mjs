const res = await fetch('http://127.0.0.1:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'analiza el documento' }] })
});
console.log(res.status);
console.log(await res.text());
