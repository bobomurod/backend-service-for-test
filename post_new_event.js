
// require Node.js >= 18 

const { randomUUID } = require('crypto');

const TYPES = ['ACCIDENT', 'SERVICE', 'TRANSFER'];
const SOURCES = ['mobile', 'partner', 'manual'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEventBody() {
  return {
    eventId: randomUUID(),                 // валидный UUID v4
    companyId: `company-${Math.floor(Math.random() * 1000)}`,
    entityId: `entity-${Math.floor(Math.random() * 10000)}`,
    type: randomItem(TYPES),
    source: randomItem(SOURCES),
    payload: {
      value: Math.floor(Math.random() * 1000),
      flag: Math.random() > 0.5
    },
    occurredAt: new Date().toISOString()    // валидный ISO 8601
  };
}

async function sendEvent() {
  const body = generateEventBody();

  const response = await fetch('http://localhost:3000/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();

  console.log('Status:', response.status);
  console.log('Request body:', body);
  console.log('Response:', text);
}

sendEvent().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
