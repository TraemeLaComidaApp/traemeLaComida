async function test() {
  try {
    const response = await fetch('http://localhost:3000/voice/translate-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Prueba Final', key: 'Prueba Final' })
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data));
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
