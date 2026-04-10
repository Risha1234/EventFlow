async function testActivity() {
  const fetch = (await import('node-fetch')).default;
  
  // Test case 1: Logged out (no header)
  console.log("Testing Case 1: No Authorization header");
  const res1 = await fetch('http://localhost:5000/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: 1, action_type: 'view' })
  });
  console.log("Status:", res1.status, await res1.json());

  // Test case 2: Invalid action type
  console.log("\nTesting Case 2: Invalid action type");
  const res2 = await fetch('http://localhost:5000/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: 1, action_type: 'invalid' })
  });
  console.log("Status:", res2.status, await res2.json());
}

testActivity();
