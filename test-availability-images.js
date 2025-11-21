async function testImages() {
  console.log('\n🖼️  Testing image URLs from availability endpoint...\n');

  try {
    const response = await fetch('https://noah.air.city/api/vehicles/availability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pickupDate: '2025-11-20',
        dropoffDate: '2025-11-21'
      })
    });

    const data = await response.json();

    console.log('Sample vehicle image URLs:');
    data.availableVehicles.slice(0, 6).forEach(v => {
      console.log(`${v.plate.padEnd(8)} | ${v.imageUrl || 'NO IMAGE'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testImages();
