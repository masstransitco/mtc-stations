async function testLocalAPIImages() {
  console.log('\n🖼️  Testing local API with image URLs...\n');

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
      return;
    }

    const data = await response.json();

    console.log('✅ SUCCESS!');
    console.log(`Available vehicles: ${data.availableCount}\n`);

    console.log('Vehicle images:');
    console.log('='.repeat(80));
    data.availableVehicles.slice(0, 6).forEach(v => {
      const hasImage = v.imageUrl ? '✅' : '❌';
      console.log(`${hasImage} ${v.plate.padEnd(8)} | ${v.make} ${v.model.padEnd(20)} | ${v.imageUrl || 'NO IMAGE'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLocalAPIImages();
