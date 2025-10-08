// public/util.js
async function jget(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('GET ' + url + ' falhou');
  return r.json();
}

async function jpost(url, data) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('POST ' + url + ' falhou');
  return r.json();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
