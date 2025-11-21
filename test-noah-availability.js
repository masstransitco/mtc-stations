const API_BASE = 'https://noah.air.city/api';

async function testAvailability() {
  // Get today's date and 7 days from now
  const today = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(today.getDate() + 7);

  const pickupDate = today.toISOString().split('T')[0];
  const dropoffDate = sevenDaysLater.toISOString().split('T')[0];

  console.log(`\n📅 Testing availability for next 7 days:`);
  console.log(`   Pickup:  ${pickupDate}`);
  console.log(`   Dropoff: ${dropoffDate}\n`);

  try {
    // Test /api/vehicles/availability endpoint
    console.log('🔍 Calling POST /api/vehicles/availability...\n');

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

    console.log('📊 RESULTS SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total Vehicles:      ${data.totalVehicles}`);
    console.log(`Available Now:       ${data.availableCount} ✅`);
    console.log(`Currently Unavail:   ${data.unavailableCount} ❌`);
    console.log(`Period (days):       ${data.periodDays}`);
    console.log('='.repeat(60));

    // Analyze the unavailable vehicles to see when they become available
    console.log('\n🚗 CURRENTLY UNAVAILABLE VEHICLES (When they become available):');
    console.log('-'.repeat(60));

    const upcomingAvailable = [];

    data.unavailableVehicles.forEach((vehicle) => {
      if (vehicle.conflictingBooking) {
        const returnDate = new Date(vehicle.conflictingBooking.returnDate);
        const daysUntilAvailable = Math.ceil((returnDate - today) / (1000 * 60 * 60 * 24));

        console.log(`${vehicle.plate.padEnd(8)} | ${vehicle.make} ${vehicle.model.padEnd(12)} | Returns: ${vehicle.conflictingBooking.returnDate.split('T')[0]} (${daysUntilAvailable} days)`);

        // Count vehicles that will become available within the next 7 days
        if (daysUntilAvailable >= 0 && daysUntilAvailable <= 7) {
          upcomingAvailable.push({
            plate: vehicle.plate,
            makeModel: `${vehicle.make} ${vehicle.model}`,
            returnDate: vehicle.conflictingBooking.returnDate.split('T')[0],
            daysUntil: daysUntilAvailable
          });
        }
      }
    });

    console.log('-'.repeat(60));

    // Summary of upcoming availability
    console.log('\n✨ UPCOMING AVAILABILITY (within 7 days):');
    console.log('='.repeat(60));

    if (upcomingAvailable.length > 0) {
      upcomingAvailable.sort((a, b) => a.daysUntil - b.daysUntil);

      console.log(`\n${upcomingAvailable.length} additional vehicle(s) will become available:\n`);

      upcomingAvailable.forEach((v) => {
        console.log(`  📅 Day ${v.daysUntil}: ${v.plate} - ${v.makeModel} (returns ${v.returnDate})`);
      });

      const totalAvailableIn7Days = data.availableCount + upcomingAvailable.length;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`TOTAL AVAILABLE IN 7 DAYS: ${totalAvailableIn7Days}`);
      console.log(`  • Currently available:     ${data.availableCount}`);
      console.log(`  • Will become available:   ${upcomingAvailable.length}`);
      console.log(`  • Still unavailable:       ${data.unavailableCount - upcomingAvailable.length}`);
      console.log(`${'='.repeat(60)}`);
    } else {
      console.log('\nNo additional vehicles will become available within the next 7 days.');
      console.log(`Current availability remains at: ${data.availableCount} vehicles`);
    }

    // Show breakdown by vehicle type
    console.log('\n🚙 AVAILABLE VEHICLES BY TYPE:');
    console.log('-'.repeat(60));

    const typeCount = {};
    data.availableVehicles.forEach(v => {
      typeCount[v.type] = (typeCount[v.type] || 0) + 1;
    });

    Object.entries(typeCount).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`  ${type.padEnd(15)} : ${count} vehicle(s)`);
    });

    console.log('\n');

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testAvailability();
