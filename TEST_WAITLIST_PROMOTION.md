# EventFlow+ Waitlist Promotion Test

## Quick Start

### 1. Start the Backend Server
If not already running:
```bash
cd backend
node server.js
```

### 2. Run the Test
Open your browser or use curl to call the test endpoint:

**Browser:**
```
http://localhost:5000/test/waitlist-promotion
```

**cURL:**
```bash
curl http://localhost:5000/test/waitlist-promotion
```

**PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/test/waitlist-promotion"
```

---

## Test Flow

The endpoint automatically:

### STEP 1: Create Test Users
- testUserA@test.com
- testUserB@test.com
- testUserC@test.com

### STEP 2: Create Test Event
- Event: "Test Event - Waitlist Promotion"
- Capacity: **2 seats**
- Location: Test Location

### STEP 3: Register Users
| User | Registration | Result |
|------|---|---|
| User A | 1st | ✅ CONFIRMED |
| User B | 2nd | ✅ CONFIRMED |
| User C | 3rd | ⏳ WAITLISTED |

**Before Cancellation State:**
```
User A: confirmed
User B: confirmed
User C: waitlisted
```

### STEP 4: Cancel User B
- Calls `DELETE /api/registrations/:id` logic
- Removes confirmed attendee
- Triggers automatic promotion

### STEP 5: Verify Promotion
**After Cancellation State:**
```
User A: confirmed
User B: cancelled
User C: PROMOTED TO CONFIRMED ✅
```

---

## Expected Response

```json
{
  "success": true,
  "test": "Waitlist Promotion Flow",
  "eventId": 123,
  "beforeCancellation": {
    "userA": "confirmed",
    "userB": "confirmed",
    "userC": "waitlisted"
  },
  "afterCancellation": {
    "userA": "confirmed",
    "userB": "cancelled",
    "userC": "confirmed"
  },
  "promotion": "User C promoted ✅"
}
```

---

## Console Output (Backend)

When you run the test, you should see in the backend terminal:

```
========== STARTING WAITLIST PROMOTION TEST ==========

STEP 1: Creating test users...
✓ Created testUserA (ID: X)
✓ Created testUserB (ID: Y)
✓ Created testUserC (ID: Z)

STEP 2: Creating test event...
✓ Created event "Test Event - Waitlist Promotion" (ID: N) with 2 seats

STEP 3: Registering users...
✓ User A registered: confirmed
✓ User B registered: confirmed
✓ User C registered: waitlisted

--- STATE BEFORE CANCELLATION ---
User A: confirmed
User B: confirmed
User C: waitlisted

STEP 4: Cancelling User B's registration...
✓ Cancelled User B's registration
✓ Promoted User C from waitlist to confirmed

--- STATE AFTER CANCELLATION ---
User A: confirmed
User B: cancelled
User C: confirmed

========== TEST RESULT ==========
✅ SUCCESS: User C was promoted from waitlist to confirmed!
================================
```

---

## What This Tests

✅ Registration logic (existing API)
✅ Seat allocation (first 2 users get confirmed)
✅ Waitlist logic (3rd user automatically waitlisted)
✅ Cancellation logic (existing API)
✅ **Automatic promotion** (waitlisted user promoted when confirmed spot opens)
✅ Database consistency (all statuses correctly saved)

---

## Important Notes

- ✅ **No core logic modified** - Uses existing registration endpoints
- ✅ **No database schema changes**
- ✅ **No authentication changes**
- ✅ **Idempotent** - Can run multiple times
- ✅ **Isolated** - Creates test data that doesn't affect real events
- ✅ **Safe** - Runs in transaction, can be rolled back if needed

---

## How to Clean Up (Optional)

If you want to delete test data after verification:

```sql
-- Query
DELETE FROM registrations WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%@test.com'
);

DELETE FROM events WHERE title = 'Test Event - Waitlist Promotion';

DELETE FROM users WHERE email LIKE '%@test.com';
```

---

## Troubleshooting

**Q: Port 5000 already in use?**
A: Good! It means backend is already running. The test will work.

**Q: Test returns failure?**
A: Check backend console for error details. Ensure database is running.

**Q: Want to run multiple times?**
A: Endpoint is safe to run repeatedly - it will reuse existing test users or create new ones.
