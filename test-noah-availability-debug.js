const API_BASE = 'https://noah.air.city/api';

async function testAvailabilityDebug() {
  const today = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(today.getDate() + 7);

  const pickupDate = today.toISOString().split('T')[0];
  const dropoffDate = sevenDaysLater.toISOString().split('T')[0];

  console.log(`\n📅 Testing availability for next 7 days:`);
  console.log(`   Pickup:  ${pickupDate}`);
  console.log(`   Dropoff: ${dropoffDate}\n`);

  try {
    const response = await fetch(`${API_BASE}/vehicles/availability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pickupDate,
        dropoffDate
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log('📦 RAW RESPONSE STRUCTURE:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testAvailabilityDebug();
