const API_BASE = 'https://noah.air.city/api';

async function testStatusEndpoint() {
  console.log('\n🔍 Testing /api/vehicles/status endpoint...\n');

  try {
    const response = await fetch(`${API_BASE}/vehicles/status?timePeriod=30d`);
    const data = await response.json();

    console.log('📊 SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total:        ${data.summary.total}`);
    console.log(`Available:    ${data.summary.available}`);
    console.log(`Reserved:     ${data.summary.reserved}`);
    console.log(`Rented:       ${data.summary.rented}`);
    console.log(`Maintenance:  ${data.summary.maintenance}`);
    console.log('='.repeat(60));

    console.log('\n🚗 VEHICLES:');
    console.log('-'.repeat(60));

    const statusCounts = {};
    data.vehicles.forEach(v => {
      statusCounts[v.currentStatus] = (statusCounts[v.currentStatus] || 0) + 1;
    });

    console.log('\nStatus breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // Show first few available vehicles
    console.log('\n📋 Available vehicles:');
    const available = data.vehicles.filter(v => v.currentStatus === 'available');
    available.slice(0, 10).forEach(v => {
      console.log(`  ${v.plate} - ${v.make} ${v.model} (${v.year})`);
    });

    if (available.length > 10) {
      console.log(`  ... and ${available.length - 10} more`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testStatusEndpoint();
