async function testLocalAPI() {
  console.log('\n🔍 Testing local API endpoint...\n');

  try {
    const response = await fetch('http://localhost:3000/api/noah/vehicles/availability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pickupDate: '2025-11-20',
        dropoffDate: '2025-11-21'
      })
    });

    if (!response.ok) {
      console.log(`❌ Response status: ${response.status}`);
      const text = await response.text();
      console.log('Response:', text);
      return;
    }

    const data = await response.json();

    console.log('✅ SUCCESS!');
    console.log(`Available vehicles: ${data.availableCount}`);
    console.log(`Total vehicles: ${data.totalVehicles}`);
    console.log('\nFirst few available vehicles:');
    data.availableVehicles.slice(0, 6).forEach(v => {
      console.log(`  - ${v.plate}: ${v.make} ${v.model} (${v.year})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLocalAPI();
