const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const pool = require("./db");
const bcrypt = require("bcrypt");
const authMiddleware = require("./middleware/auth");
const adminAuthMiddleware = require("./middleware/adminAuth");
const OpenAI = require("openai");
const jwt = require("jsonwebtoken");
const { redisClient } = require("./redisClient");
const { getCache, setCache, deleteCache } = require("./utils/cache");
const { authLimiter, activityLimiter, generalLimiter } = require("./middleware/rateLimiter");
const app = express();
require("dotenv").config();

// ENV VALIDATION
const REQUIRED_ENV = ["DATABASE_URL"];
const RECOMMENDED_ENV = ["JWT_SECRET", "REDIS_URL", "OPENAI_API_KEY"];

REQUIRED_ENV.forEach(name => {
  if (!process.env[name]) {
    console.error(`❌ CRITICAL: Missing required environment variable: ${name}`);
  }
});

RECOMMENDED_ENV.forEach(name => {
  if (!process.env[name]) {
    console.warn(`⚠️  Warning: Missing recommended environment variable: ${name}`);
  }
});

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: true,   // ✅ allow all origins temporarily
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Basic in-memory throttle for WebSocket events
const wsThrottle = new Map();
function emitThrottled(eventName, payload) {
  const key = `${eventName}:${payload.eventId}:${payload.action_type || ''}`;
  const now = Date.now();
  const lastEmit = wsThrottle.get(key) || 0;
  
  if (now - lastEmit > 500) { // 500ms throttle
    io.emit(eventName, payload);
    wsThrottle.set(key, now);
  }
}

app.use(cors());
app.use(express.json());

// APPLY RATE LIMITERS
// Auth Limiters (Strict)
app.use("/login", authLimiter);
app.use("/register", authLimiter);

// Activity Limiter (Moderate)
app.use("/activity", activityLimiter);

// General API & Event Limiters (Relaxed)
app.use("/api", generalLimiter);
app.use("/events", generalLimiter);

// Handle WebSocket connections
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Backend working");
});

app.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: "Protected route",
    user: req.user,
  });
});

// Helper for validating dynamic responses
function validateResponses(form_fields, responses) {
  if (!Array.isArray(form_fields) || form_fields.length === 0) return null;
  const resp = responses || {};
  for (const field of form_fields) {
    if (field.required) {
      if (resp[field.id] === undefined || resp[field.id] === null || resp[field.id] === '') {
        return `Field "${field.label}" is required.`;
      }
    }
  }
  return null;
}

app.post("/events", authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, description, date, location, total_seats, is_paid, tickets, form_fields, category } = req.body;

    // RULE: Only organizer or admin can create events
    if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Only organizers or admins can create events" });
    }

    const seats = parseInt(total_seats) || 0;
    const isPaid = is_paid === true;

    // Process form fields
    let processedFields = [];
    if (Array.isArray(form_fields)) {
      for (const field of form_fields) {
        if (!field.label || typeof field.label !== 'string' || field.label.trim() === '') continue;
        if (!['text', 'number', 'select', 'textarea'].includes(field.type)) continue;
        if (field.type === 'select' && (!Array.isArray(field.options) || field.options.length === 0)) continue;
        
        processedFields.push({
          id: field.id || 'fld_' + Date.now() + Math.random().toString(36).substr(2, 9),
          label: field.label.trim(),
          type: field.type,
          required: field.required === true,
          options: field.type === 'select' ? field.options : undefined
        });
      }
    }

    // Server-side validation for paid events
    if (isPaid) {
      if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
        return res.status(400).json({ error: "Paid events must have at least one ticket type" });
      }
      for (const ticket of tickets) {
        if (!ticket.name || typeof ticket.name !== 'string' || ticket.name.trim() === '') {
          return res.status(400).json({ error: "Each ticket must have a valid name" });
        }
        if (typeof ticket.price !== 'number' || ticket.price < 0) {
          return res.status(400).json({ error: "Each ticket must have a valid price (>= 0)" });
        }
        if (!Number.isInteger(ticket.quantity) || ticket.quantity <= 0) {
          return res.status(400).json({ error: "Each ticket must have a valid quantity (> 0)" });
        }
      }
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO events (title, description, date, location, created_by, total_seats, available_seats, is_paid, form_fields, category)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9)
       RETURNING *`,
      [title, description, date, location, req.user.id, seats, isPaid, JSON.stringify(processedFields), category || 'General']
    );

    const event = result.rows[0];

    // Insert tickets if paid event
    let createdTickets = [];
    if (isPaid && tickets && tickets.length > 0) {
      for (const ticket of tickets) {
        const ticketResult = await client.query(
          `INSERT INTO tickets (event_id, name, price, quantity, sold)
           VALUES ($1, $2, $3, $4, 0)
           RETURNING *`,
          [event.id, ticket.name.trim(), ticket.price, ticket.quantity]
        );
        createdTickets.push(ticketResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    res.json({ ...event, tickets: createdTickets });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Error creating event" });
  } finally {
    client.release();
  }
});

// GET USERS FROM DB - Protected and Admin Only
app.get("/users", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching users" });
  }
});
// GET RECOMMENDED EVENTS
app.get("/api/events/recommended", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    let userId = null;
    let cacheKey = "recommended:guest";

    if (token) {
      try {
        const secret = process.env.JWT_SECRET || "secretkey";
        const decoded = jwt.verify(token, secret);
        userId = decoded.id;
        cacheKey = `recommended:user:${userId}`;
      } catch (err) {
        // Fallback to guest key if token is invalid
      }
    }

    // Check Cache
    const cachedData = await getCache(cacheKey);
    if (cachedData) return res.json(cachedData);

    let candidates = [];

    // If userId exists, use personalized logic
    if (userId) {
      // 1. Get preferred categories using weighted activity
      const prefRes = await pool.query(`
        SELECT e.category, SUM(
          CASE 
            WHEN ua.action_type = 'register' THEN 5 
            WHEN ua.action_type = 'click' THEN 3 
            ELSE 1 
          END
        ) as weight
        FROM user_activity ua
        JOIN events e ON ua.event_id = e.id
        WHERE ua.user_id = $1
        GROUP BY e.category
        ORDER BY weight DESC
        LIMIT 3
      `, [userId]);

      const preferredCategories = prefRes.rows.map(r => r.category);

      // 2. Fetch candidates with popularity
      const candidatesRes = await pool.query(`
        WITH popularity AS (
          SELECT event_id, COUNT(*) as attendee_count
          FROM (
            SELECT event_id FROM registrations WHERE status != 'cancelled'
            UNION ALL
            SELECT event_id FROM bookings WHERE status = 'success'
          ) combined_regs
          GROUP BY event_id
        )
        SELECT e.*, COALESCE(p.attendee_count, 0) as attendee_count
        FROM events e
        LEFT JOIN popularity p ON e.id = p.event_id
        WHERE e.date >= CURRENT_DATE
        AND e.id NOT IN (
          SELECT event_id FROM registrations WHERE user_id = $1 AND status != 'cancelled'
          UNION
          SELECT event_id FROM bookings WHERE user_id = $1 AND status = 'success'
        )
        AND e.id NOT IN (
          SELECT event_id FROM user_activity WHERE user_id = $1 GROUP BY event_id HAVING COUNT(*) > 10
        )
      `, [userId]);

      candidates = candidatesRes.rows;

      // 3. Fallback if no activity found for user
      if (preferredCategories.length === 0) {
        const latestRes = await pool.query(`
          SELECT e.*, COALESCE(p.attendee_count, 0) as attendee_count
          FROM events e
          LEFT JOIN (
            SELECT event_id, COUNT(*) as attendee_count FROM registrations GROUP BY event_id
          ) p ON e.id = p.event_id
          WHERE e.date >= CURRENT_DATE
          ORDER BY e.date DESC
          LIMIT 10
        `);
        const result = latestRes.rows;
        await setCache(cacheKey, result, 60);
        return res.json(result);
      }

      // 4. Scoring logic
      candidates = candidates.map(event => {
        let score = 0;
        if (preferredCategories.includes(event.category)) score += 5;
        if (event.attendee_count > 0) score += 2;
        score += 1;
        return { ...event, score };
      });

      candidates.sort((a, b) => b.score - a.score);
      candidates = candidates.slice(0, 10);
    } 
    
    // 5. Guest or Final Fallback
    if (candidates.length === 0) {
      const popularRes = await pool.query(`
        SELECT e.*, COALESCE(p.attendee_count, 0) as attendee_count
        FROM events e
        LEFT JOIN (
          SELECT event_id, COUNT(*) as attendee_count FROM registrations GROUP BY event_id
        ) p ON e.id = p.event_id
        WHERE e.date >= CURRENT_DATE
        ORDER BY attendee_count DESC
        LIMIT 10
      `);
      candidates = popularRes.rows;
    }

    // Set Cache and return
    await setCache(cacheKey, candidates, 60);
    res.json(candidates);

  } catch (err) {
    console.error("Recommendation System Error:", err);
    res.json([]);
  }
});

// GET TRENDING EVENTS (Weighted Score based on recent activity)
app.get("/api/events/trending", async (req, res) => {
  try {
    const cacheKey = "trending";
    const cachedData = await getCache(cacheKey);
    if (cachedData) return res.json(cachedData);

    const result = await pool.query(`
      WITH activity_scores AS (
        SELECT 
          event_id,
          SUM(CASE 
            WHEN action_type = 'register' THEN 5 
            WHEN action_type = 'click' THEN 3 
            ELSE 1 
          END) as score
        FROM user_activity
        WHERE created_at >= NOW() - INTERVAL '48 hours'
        GROUP BY event_id
      )
      SELECT e.*, COALESCE(s.score, 0) as trending_score
      FROM events e
      JOIN activity_scores s ON e.id = s.event_id
      WHERE e.date >= CURRENT_DATE
      ORDER BY trending_score DESC
      LIMIT 10
    `);
    
    const data = result.rows;
    await setCache(cacheKey, data, 120); // Cache for 2 minutes
    res.json(data);
  } catch (err) {
    console.error("Trending System Error:", err);
    res.json([]);
  }
});

// REDIS TEST ENDPOINT
app.get("/redis-test", async (req, res) => {
  try {
    const key = "test-key";
    const value = { status: "working", timestamp: new Date() };
    
    // Test set with 60s TTL
    const { setCache, getCache } = require("./utils/cache");
    await setCache(key, value, 60);
    
    // Test get
    const cachedValue = await getCache(key);
    
    res.json({
      message: "Redis test complete",
      success: !!cachedValue,
      data: cachedValue
    });
  } catch (err) {
    console.error("Redis Test Error:", err);
    res.status(500).json({ error: "Redis test failed", details: err.message });
  }
});

app.get("/events", authMiddleware, async (req, res) => {
  try {
    const { is_paid, search, date_filter, min_price, max_price } = req.query;
    
    let query = "SELECT * FROM events WHERE 1=1";
    const params = [];

    if (is_paid !== undefined && is_paid !== '') {
      params.push(is_paid === 'true');
      query += ` AND is_paid = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      query += ` AND (title ILIKE $${params.length} OR location ILIKE $${params.length})`;
    }

    if (date_filter === 'today') {
      query += ` AND DATE(date) = CURRENT_DATE`;
    } else if (date_filter === 'upcoming') {
      query += ` AND DATE(date) >= CURRENT_DATE`;
    }

    const minP = parseFloat(min_price);
    const maxP = parseFloat(max_price);

    if (!isNaN(minP) || !isNaN(maxP)) {
      let priceConds = [];
      if (!isNaN(minP)) {
        params.push(minP);
        priceConds.push(`price >= $${params.length}`);
      }
      if (!isNaN(maxP)) {
        params.push(maxP);
        priceConds.push(`price <= $${params.length}`);
      }
      
      const priceClause = priceConds.join(' AND ');
      
      let freeAllowed = true;
      if (!isNaN(minP) && minP > 0) freeAllowed = false;
      
      if (freeAllowed) {
        query += ` AND (id IN (SELECT event_id FROM tickets WHERE ${priceClause}) OR is_paid = false)`;
      } else {
        query += ` AND id IN (SELECT event_id FROM tickets WHERE ${priceClause})`;
      }
    }

    // Add ordering to make results deterministic
    query += " ORDER BY date ASC";

    const result = await pool.query(query, params);
    const events = result.rows;

    // Fetch tickets for all events in one query
    const eventIds = events.map(e => e.id);
    let ticketsMap = {};
    if (eventIds.length > 0) {
      const ticketsResult = await pool.query(
        "SELECT * FROM tickets WHERE event_id = ANY($1) ORDER BY id ASC",
        [eventIds]
      );
      ticketsResult.rows.forEach(ticket => {
        if (!ticketsMap[ticket.event_id]) ticketsMap[ticket.event_id] = [];
        ticketsMap[ticket.event_id].push(ticket);
      });
    }

    const eventsWithTickets = events.map(event => ({
      ...event,
      tickets: ticketsMap[event.id] || []
    }));

    res.json(eventsWithTickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching events" });
  }
});

app.get("/api/events/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM events WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = result.rows[0];

    // Fetch tickets for this event
    const ticketsResult = await pool.query(
      "SELECT * FROM tickets WHERE event_id = $1 ORDER BY id ASC",
      [id]
    );

    res.json({ ...event, tickets: ticketsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching event details" });
  }
});

// REGISTER USER
app.post("/register", async (req, res) => {
  console.log("Register body:", req.body);
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, email, or password"
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, role",
      [name, email, hashedPassword]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Register error:", error);

    // handle duplicate email nicely
    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error registering user"
    });
  }
});

// UPGRADE TO ORGANIZER
app.put("/become-organizer", authMiddleware, async (req, res) => {
  try {
    console.log('Upgrading user to organizer:', req.user.id);
    
    const result = await pool.query(
      "UPDATE users SET role = 'organizer' WHERE id = $1 RETURNING id, name, email, role",
      [req.user.id]
    );
    
    // Create new token with updated role
    const updatedUser = result.rows[0];
    console.log('User upgraded to organizer:', updatedUser);
    
    const secret = process.env.JWT_SECRET || "secretkey";
    const token = jwt.sign(
      { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
      secret,
      { expiresIn: "1h" }
    );

    res.json({ user: updatedUser, token });
  } catch (err) {
    console.error('Error upgrading to organizer:', err);
    res.status(500).json({ error: "Error upgrading to organizer" });
  }
});
// LOGIN USER
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // check user exists
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];
    console.log("User from DB:", user);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // create token with role
    const secret = process.env.JWT_SECRET || "secretkey";
    if (!process.env.JWT_SECRET) {
      console.warn("⚠️  JWT_SECRET is missing. Using fallback for login.");
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn: "10h" }
    );

    res.json({ token, role: user.role });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// TRACK USER ACTIVITY
app.post("/activity", authMiddleware, async (req, res) => {
  try {
    const { event_id, action_type } = req.body;
    const user_id = req.user ? req.user.id : null;

    // Skip insert if user not logged in or missing data, but return success
    if (!user_id || !event_id || !action_type) {
      return res.json({ success: true });
    }

    const validActions = ['view', 'click', 'register'];
    if (!validActions.includes(action_type)) {
      return res.json({ success: true });
    }

    await pool.query(
      "INSERT INTO user_activity (user_id, event_id, action_type) VALUES ($1, $2, $3)",
      [user_id, event_id, action_type]
    );

    // Emit throttled real-time activity
    emitThrottled("new_activity", {
      eventId: event_id,
      action_type: action_type,
      timestamp: new Date()
    });

    // Invalidate caches
    if (user_id) {
      await deleteCache(`recommended:user:${user_id}`);
    }
    await deleteCache('trending');

    res.json({ success: true });
  } catch (err) {
    console.error("Activity Tracking Error (Internal):", err);
    res.json({ success: true }); 
  }
});

// REGISTER FOR EVENT
app.post("/api/registrations", authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { event_id, responses } = req.body;
    const user_id = req.user.id;

    await client.query('BEGIN');

    // Lock event row
    const eventRes = await client.query(
      'SELECT * FROM events WHERE id = $1 FOR UPDATE',
      [event_id]
    );

    if (eventRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventRes.rows[0];

    // Validate dynamic responses
    const validationError = validateResponses(event.form_fields, responses);
    if (validationError) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: validationError });
    }

    // Check existing registration
    const regRes = await client.query(
      'SELECT * FROM registrations WHERE user_id = $1 AND event_id = $2',
      [user_id, event_id]
    );

    let status = 'confirmed';
    if (regRes.rows.length > 0) {
      const existingReg = regRes.rows[0];
      if (existingReg.status !== 'cancelled') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Already registered for this event" });
      }

      // Re-registration logic
      if (event.available_seats > 0) {
        status = 'confirmed';
        await client.query(
          'UPDATE events SET available_seats = available_seats - 1 WHERE id = $1',
          [event_id]
        );
      } else {
        status = 'waitlisted';
      }

      await client.query(
        'UPDATE registrations SET status = $1, registered_at = NOW(), responses = $2 WHERE id = $3',
        [status, JSON.stringify(responses || {}), existingReg.id]
      );
    } else {
      // New registration logic
      if (event.available_seats > 0) {
        status = 'confirmed';
        await client.query(
          'UPDATE events SET available_seats = available_seats - 1 WHERE id = $1',
          [event_id]
        );
      } else {
        status = 'waitlisted';
      }

      await client.query(
        'INSERT INTO registrations (user_id, event_id, status, responses) VALUES ($1, $2, $3, $4)',
        [user_id, event_id, status, JSON.stringify(responses || {})]
      );
    }

    await client.query('COMMIT');
    
    // Invalidate Caches
    const organizerId = event.created_by;
    await deleteCache(`recommended:user:${user_id}`);
    await deleteCache('trending');
    if (organizerId) {
      await deleteCache(`organizer:events:${organizerId}`);
    }

    // Emit real-time registration update
    emitThrottled("new_activity", {
      eventId: event_id,
      action_type: 'register',
      timestamp: new Date()
    });
    
    res.json({ status });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Error registering for event" });
  } finally {
    client.release();
  }
});

// GET MY REGISTRATIONS
app.get("/api/registrations/my", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;
    const result = await pool.query(
      `SELECT r.id, r.status, e.title, e.date, e.location, e.id as event_id
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id = $1 AND r.status != 'cancelled'
       ORDER BY r.registered_at DESC`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching registrations" });
  }
});

// CANCEL REGISTRATION
app.delete("/api/registrations/:id", authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const reg_id = req.params.id;
    const user_id = req.user.id;

    await client.query('BEGIN');

    // Lock registration row
    const regRes = await client.query(
      'SELECT * FROM registrations WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [reg_id, user_id]
    );

    if (regRes.rows.length === 0 || regRes.rows[0].status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Registration not found" });
    }

    const registration = regRes.rows[0];
    const event_id = registration.event_id;

    if (registration.status === 'confirmed') {
      // Lock event row
      const eventLockRes = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [event_id]);
      const eventTitle = eventLockRes.rows[0] ? eventLockRes.rows[0].title : 'an event';

      // Mark current as cancelled
      await client.query(
        'UPDATE registrations SET status = \'cancelled\' WHERE id = $1',
        [reg_id]
      );

      // Find oldest waitlisted user
      const waitlistRes = await client.query(
        'SELECT * FROM registrations WHERE event_id = $1 AND status = \'waitlisted\' ORDER BY registered_at ASC LIMIT 1 FOR UPDATE',
        [event_id]
      );

      if (waitlistRes.rows.length > 0) {
        // Promote waitlisted user
        await client.query(
          'UPDATE registrations SET status = \'confirmed\' WHERE id = $1',
          [waitlistRes.rows[0].id]
        );
        
        const promotedUserId = waitlistRes.rows[0].user_id;
        
        await client.query('COMMIT');
        
        // Emit both CANCELLED and PROMOTED events
        io.emit("event:update", {
          type: "CANCELLED",
          eventId: event_id,
          userId: user_id,
          timestamp: new Date()
        });
        
        io.emit("event:update", {
          type: "PROMOTED",
          eventId: event_id,
          userId: promotedUserId,
          timestamp: new Date()
        });

        io.emit("waitlist_promoted", {
          userId: promotedUserId,
          eventTitle: eventTitle,
          message: "You have been moved from waitlist to confirmed!"
        });
      } else {
        // Increase available seats
        await client.query(
          'UPDATE events SET available_seats = available_seats + 1 WHERE id = $1',
          [event_id]
        );
        
        await client.query('COMMIT');
        
        // Emit CANCELLED event
        io.emit("event:update", {
          type: "CANCELLED",
          eventId: event_id,
          userId: user_id,
          timestamp: new Date()
        });
      }
    } else {
      // Just mark as cancelled
      await client.query(
        'UPDATE registrations SET status = \'cancelled\' WHERE id = $1',
        [reg_id]
      );
      
      await client.query('COMMIT');
      
      // Emit CANCELLED event
      io.emit("event:update", {
        type: "CANCELLED",
        eventId: event_id,
        userId: user_id,
        timestamp: new Date()
      });
    }
    res.json({ message: "Registration cancelled successfully" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Error cancelling registration" });
  } finally {
    client.release();
  }
});

// GET ORGANIZER'S EVENTS
app.get("/api/organizer/events", authMiddleware, async (req, res) => {
  try {
    // Only organizers and admins can access
    if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Only organizers and admins can access this." });
    }

    const user_id = req.user.id;
    const cacheKey = `organizer:events:${user_id}`;

    // Check Cache
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      console.log(`Returning cached events for organizer ${user_id}`);
      return res.json(cachedData);
    }

    const result = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM user_activity WHERE event_id = e.id AND action_type = 'view') as views,
        (SELECT COUNT(*) FROM user_activity WHERE event_id = e.id AND action_type = 'click') as clicks,
        (SELECT COUNT(*) FROM registrations WHERE event_id = e.id AND status != 'cancelled') as registration_count,
        (SELECT COALESCE(SUM(t.price), 0) FROM bookings b JOIN tickets t ON b.ticket_id = t.id WHERE b.event_id = e.id AND b.status = 'success') as revenue
       FROM events e 
       WHERE created_by = $1 
       ORDER BY date DESC`,
      [user_id]
    );

    // Fetch tickets for organizer's events
    const events = result.rows;
    // ... rest of the existing logic to calculate insights ...
    const eventIds = events.map(e => e.id);
    let ticketsMap = {};
    if (eventIds.length > 0) {
      const ticketsResult = await pool.query(
        "SELECT * FROM tickets WHERE event_id = ANY($1) ORDER BY id ASC",
        [eventIds]
      );
      ticketsResult.rows.forEach(ticket => {
        if (!ticketsMap[ticket.event_id]) ticketsMap[ticket.event_id] = [];
        ticketsMap[ticket.event_id].push(ticket);
      });
    }

    const eventsWithTickets = events.map(event => {
      const convRate = event.views > 0 ? (event.registration_count / event.views) * 100 : 0;
      
      const totalViews = events.reduce((s, e) => s + parseInt(e.views), 0);
      const totalRegs = events.reduce((s, e) => s + parseInt(e.registration_count), 0);
      const avgConvRate = totalViews > 0 ? (totalRegs / totalViews) * 100 : 0;
      
      const insights = [];
      
      if (event.views >= 5) {
        if (convRate > avgConvRate * 1.5) {
          insights.push({ type: 'performance', text: `Top Performer: Conversion is ${Math.round((convRate/avgConvRate - 1) * 100)}% better than average.`, icon: 'Sparkles' });
        }
        if (event.views > 20 && convRate < 5) {
          insights.push({ type: 'engagement', text: 'High interest, low conversion. Try refining the description.', icon: 'AlertCircle' });
        }
        if (event.registration_count > 5 && event.available_seats < event.total_seats * 0.3) {
          insights.push({ type: 'growth', text: 'High Demand: Seats are filling up fast!', icon: 'TrendingUp' });
        }
      }

      if (insights.length === 0) {
        if (event.views === 0) insights.push({ type: 'info', text: 'This event has not received any views yet.', icon: 'Sparkles' });
        else if (event.registration_count === 0) insights.push({ type: 'info', text: 'Users are viewing this event but not registering yet.', icon: 'TrendingUp' });
        else insights.push({ type: 'info', text: 'This event has started gaining traction.', icon: 'TrendingUp' });
      }

      if (insights.length === 0) insights.push({ type: 'info', text: 'Engagement is still building for this event.', icon: 'Sparkles' });

      return {
        ...event,
        views: parseInt(event.views),
        clicks: parseInt(event.clicks),
        registration_count: parseInt(event.registration_count),
        revenue: parseFloat(event.revenue),
        tickets: ticketsMap[event.id] || [],
        insights: insights.slice(0, 3) 
      };
    });

    // Store in Cache (60s TTL)
    await setCache(cacheKey, eventsWithTickets, 60);
    res.json(eventsWithTickets);
  } catch (err) {
    console.error('Error in /api/organizer/events:', err);
    res.status(500).json({ error: "Error fetching organizer events" });
  }
});

// GET ORGANIZER ACTIVITY FEED
app.get("/api/organizer/activity", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied." });
    }

    const user_id = req.user.id;
    const result = await pool.query(
      `SELECT ua.id, ua.action_type, ua.created_at, e.title as event_title, u.name as user_name
       FROM user_activity ua
       JOIN events e ON ua.event_id = e.id
       LEFT JOIN users u ON ua.user_id = u.id
       WHERE e.created_by = $1
       ORDER BY ua.created_at DESC
       LIMIT 20`,
      [user_id]
    );

    const formattedActivity = result.rows.map(row => ({
      id: row.id,
      type: row.action_type,
      message: `${row.user_name || 'A user'} ${row.action_type === 'register' ? 'registered' : row.action_type === 'click' ? 'clicked' : 'viewed'} "${row.event_title}"`,
      timestamp: row.created_at
    }));

    res.json(formattedActivity);
  } catch (err) {
    console.error('Error in /api/organizer/activity:', err);
    res.status(500).json({ error: "Error fetching activity" });
  }
});

// GET EVENT ATTENDEES (CONFIRMED + WAITLISTED)
app.get("/api/organizer/events/:id/attendees", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Verify organizer owns this event
    const eventRes = await pool.query(
      "SELECT * FROM events WHERE id = $1",
      [id]
    );

    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventRes.rows[0];
    if (event.created_by !== user_id) {
      return res.status(403).json({ error: "You can only view attendees for your own events" });
    }

    // Fetch confirmed attendees
    const confirmedRes = await pool.query(
      `SELECT u.id, u.name, u.email, r.registered_at, r.responses, b.ticket_type
       FROM registrations r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN bookings b ON b.event_id = r.event_id AND b.user_id = u.id AND b.status = 'success'
       WHERE r.event_id = $1 AND r.status = 'confirmed'
       ORDER BY r.registered_at ASC`,
      [id]
    );

    // Fetch waitlisted attendees
    const waitlistedRes = await pool.query(
      `SELECT u.id, u.name, u.email, r.registered_at, r.responses, b.ticket_type
       FROM registrations r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN bookings b ON b.event_id = r.event_id AND b.user_id = u.id AND b.status = 'success'
       WHERE r.event_id = $1 AND r.status = 'waitlisted'
       ORDER BY r.registered_at ASC`,
      [id]
    );

    res.json({
      confirmed: confirmedRes.rows,
      waitlisted: waitlistedRes.rows,
      form_fields: event.form_fields || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching attendees" });
  }
});

// GET EVENT ANALYTICS
app.get("/api/organizer/events/:id/analytics", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Verify organizer owns this event
    const eventRes = await pool.query(
      "SELECT * FROM events WHERE id = $1",
      [id]
    );

    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventRes.rows[0];
    if (event.created_by !== user_id) {
      return res.status(403).json({ error: "You can only view analytics for your own events" });
    }

    // Count registrations by status
    const statsRes = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM registrations
       WHERE event_id = $1 AND status != 'cancelled'
       GROUP BY status`,
      [id]
    );

    // Parse counts
    let confirmed_count = 0;
    let waitlist_count = 0;

    statsRes.rows.forEach(row => {
      if (row.status === 'confirmed') {
        confirmed_count = parseInt(row.count);
      } else if (row.status === 'waitlisted') {
        waitlist_count = parseInt(row.count);
      }
    });

    // Calculate fill rate
    const total_seats = event.total_seats || 1;
    const available_seats = event.available_seats || 0;
    const fill_rate = ((total_seats - available_seats) / total_seats) * 100;

    res.json({
      confirmed: confirmed_count,
      waitlisted: waitlist_count,
      available_seats: available_seats,
      total_seats: total_seats,
      fill_rate: Math.round(fill_rate * 100) / 100
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching event analytics" });
  }
});

// GET EVENT ANALYTICS TIMESERIES - Registration growth over time
app.get("/api/organizer/events/:id/analytics/timeseries", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Verify organizer owns this event
    const eventRes = await pool.query(
      "SELECT * FROM events WHERE id = $1",
      [id]
    );

    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventRes.rows[0];
    if (event.created_by !== user_id) {
      return res.status(403).json({ error: "You can only view analytics for your own events" });
    }

    // Query registrations grouped by time (5-minute intervals)
    const timeseriesRes = await pool.query(
      `SELECT
         DATE_TRUNC('minute', registered_at) as time,
         COUNT(*) as count
       FROM registrations
       WHERE event_id = $1 AND status = 'confirmed'
       GROUP BY DATE_TRUNC('minute', registered_at)
       ORDER BY time ASC`,
      [id]
    );

    // Format data for frontend chart
    const timeseries = timeseriesRes.rows.map(row => ({
      time: row.time ? new Date(row.time).toISOString() : null,
      count: parseInt(row.count)
    }));

    res.json(timeseries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching timeseries data" });
  }
});

// GET EVENT REGISTRATION TRENDS (Grouped by Day, with gaps filled)
app.get("/api/organizer/event-registrations/:eventId", authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    const user_id = req.user.id;

    // 1. Verify ownership
    const eventRes = await pool.query(
      "SELECT id, created_at FROM events WHERE id = $1 AND created_by = $2",
      [eventId, user_id]
    );

    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: "Event not found or access denied." });
    }

    const eventCreatedAt = eventRes.rows[0].created_at;

    // 2. Fetch registrations grouped by day with continuous date range
    const result = await pool.query(`
      WITH date_range AS (
        SELECT generate_series(
          LEAST(
            COALESCE((SELECT MIN(registered_at)::date FROM registrations WHERE event_id = $1), $2::date),
            $2::date
          ),
          CURRENT_DATE,
          '1 day'::interval
        )::date as day
      )
      SELECT 
        dr.day as date,
        COALESCE(r.count, 0) as count
      FROM date_range dr
      LEFT JOIN (
        SELECT 
          (registered_at AT TIME ZONE 'UTC')::date as day,
          COUNT(*) as count
        FROM registrations
        WHERE event_id = $1 AND status != 'cancelled'
        GROUP BY (registered_at AT TIME ZONE 'UTC')::date
      ) r ON dr.day = r.day
      ORDER BY dr.day ASC
    `, [eventId, eventCreatedAt]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error in /api/organizer/event-registrations:', err);
    res.status(500).json({ error: "Error fetching registration trends" });
  }
});

// TEST ENDPOINT: Full Registration → Waitlist → Promotion Flow
app.get("/test/waitlist-promotion", async (req, res) => {
  const client = await pool.connect();
  try {
    console.log("\n========== STARTING WAITLIST PROMOTION TEST ==========\n");
    
    // Step 1: Create test users
    console.log("STEP 1: Creating test users...");
    const testUsers = {};
    const usernames = ['testUserA', 'testUserB', 'testUserC'];
    const hashedPassword = await bcrypt.hash('testpass123', 10);
    
    for (const username of usernames) {
      try {
        const result = await pool.query(
          "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'user') RETURNING id, name, email",
          [username, `${username}@test.com`, hashedPassword]
        );
        testUsers[username] = result.rows[0];
        console.log(`✓ Created ${username} (ID: ${testUsers[username].id})`);
      } catch (err) {
        // User might already exist, try to fetch
        const existingUser = await pool.query("SELECT id, name, email FROM users WHERE email = $1", [`${username}@test.com`]);
        if (existingUser.rows.length > 0) {
          testUsers[username] = existingUser.rows[0];
          console.log(`✓ Using existing ${username} (ID: ${testUsers[username].id})`);
        }
      }
    }
    
    // Step 2: Create test event with 2 seats
    console.log("\nSTEP 2: Creating test event with 2 seats...");
    const eventResult = await pool.query(
      `INSERT INTO events (title, description, date, location, created_by, total_seats, available_seats)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, title, total_seats, available_seats`,
      ['Test Event - Waitlist Promotion', 'Test event for waitlist promotion flow', '2026-04-20 10:00:00', 'Test Location', testUsers.testUserA.id, 2]
    );
    const testEvent = eventResult.rows[0];
    console.log(`✓ Created event "${testEvent.title}" (ID: ${testEvent.id}) with ${testEvent.total_seats} seats`);
    
    // Step 3: Register User A (should be CONFIRMED)
    console.log("\nSTEP 3: Registering users...");
    const registrationsResult = {};
    
    await client.query('BEGIN');
    
    // Register User A
    const eventCheckA = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [testEvent.id]);
    const eventA = eventCheckA.rows[0];
    
    let statusA = 'confirmed';
    if (eventA.available_seats > 0) {
      await client.query('UPDATE events SET available_seats = available_seats - 1 WHERE id = $1', [testEvent.id]);
    } else {
      statusA = 'waitlisted';
    }
    
    const regA = await client.query(
      'INSERT INTO registrations (user_id, event_id, status) VALUES ($1, $2, $3) RETURNING id, status',
      [testUsers.testUserA.id, testEvent.id, statusA]
    );
    registrationsResult.userA = { id: regA.rows[0].id, status: statusA };
    console.log(`✓ User A registered: ${statusA}`);
    
    // Register User B
    const eventCheckB = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [testEvent.id]);
    const eventB = eventCheckB.rows[0];
    
    let statusB = 'confirmed';
    if (eventB.available_seats > 0) {
      await client.query('UPDATE events SET available_seats = available_seats - 1 WHERE id = $1', [testEvent.id]);
    } else {
      statusB = 'waitlisted';
    }
    
    const regB = await client.query(
      'INSERT INTO registrations (user_id, event_id, status) VALUES ($1, $2, $3) RETURNING id, status',
      [testUsers.testUserB.id, testEvent.id, statusB]
    );
    registrationsResult.userB = { id: regB.rows[0].id, status: statusB };
    console.log(`✓ User B registered: ${statusB}`);
    
    // Register User C
    const eventCheckC = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [testEvent.id]);
    const eventC = eventCheckC.rows[0];
    
    let statusC = 'confirmed';
    if (eventC.available_seats > 0) {
      await client.query('UPDATE events SET available_seats = available_seats - 1 WHERE id = $1', [testEvent.id]);
    } else {
      statusC = 'waitlisted';
    }
    
    const regC = await client.query(
      'INSERT INTO registrations (user_id, event_id, status) VALUES ($1, $2, $3) RETURNING id, status',
      [testUsers.testUserC.id, testEvent.id, statusC]
    );
    registrationsResult.userC = { id: regC.rows[0].id, status: statusC };
    console.log(`✓ User C registered: ${statusC}`);
    
    await client.query('COMMIT');
    
    // Show state BEFORE cancellation
    console.log("\n--- STATE BEFORE CANCELLATION ---");
    console.log(`User A: ${registrationsResult.userA.status}`);
    console.log(`User B: ${registrationsResult.userB.status}`);
    console.log(`User C: ${registrationsResult.userC.status}`);
    
    // Step 4: Cancel User B's registration
    console.log("\nSTEP 4: Cancelling User B's registration...");
    
    await client.query('BEGIN');
    
    // Lock and fetch User B's registration
    const userBRegRes = await client.query(
      'SELECT * FROM registrations WHERE id = $1 FOR UPDATE',
      [registrationsResult.userB.id]
    );
    const userBReg = userBRegRes.rows[0];
    
    if (userBReg.status === 'confirmed') {
      // Lock event
      await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [testEvent.id]);
      
      // Mark as cancelled
      await client.query(
        'UPDATE registrations SET status = \'cancelled\' WHERE id = $1',
        [registrationsResult.userB.id]
      );
      
      // Find oldest waitlisted user
      const waitlistRes = await client.query(
        'SELECT * FROM registrations WHERE event_id = $1 AND status = \'waitlisted\' ORDER BY registered_at ASC LIMIT 1 FOR UPDATE',
        [testEvent.id]
      );
      
      if (waitlistRes.rows.length > 0) {
        // Promote waitlisted user
        await client.query(
          'UPDATE registrations SET status = \'confirmed\' WHERE id = $1',
          [waitlistRes.rows[0].id]
        );
        console.log(`✓ Cancelled User B's registration`);
        console.log(`✓ Promoted User ${waitlistRes.rows[0].user_id === testUsers.testUserC.id ? 'C' : 'Unknown'} from waitlist to confirmed`);
      } else {
        // No waitlist, increase available seats
        await client.query(
          'UPDATE events SET available_seats = available_seats + 1 WHERE id = $1',
          [testEvent.id]
        );
        console.log(`✓ Cancelled User B's registration`);
        console.log(`✓ No waitlisted users - available seats increased`);
      }
    }
    
    await client.query('COMMIT');
    
    // Step 5: Verify final state
    console.log("\nSTEP 5: Verifying promotion...");
    const finalStates = await pool.query(
      `SELECT user_id, status FROM registrations 
       WHERE event_id = $1 
       ORDER BY user_id`,
      [testEvent.id]
    );
    
    const userIdMap = {
      [testUsers.testUserA.id]: 'User A',
      [testUsers.testUserB.id]: 'User B',
      [testUsers.testUserC.id]: 'User C'
    };
    
    console.log("\n--- STATE AFTER CANCELLATION ---");
    finalStates.rows.forEach(row => {
      console.log(`${userIdMap[row.user_id]}: ${row.status}`);
    });
    
    // Verify promotion happened
    const userCFinal = finalStates.rows.find(r => r.user_id === testUsers.testUserC.id);
    const promotionSuccess = userCFinal && userCFinal.status === 'confirmed';
    
    console.log("\n========== TEST RESULT ==========");
    if (promotionSuccess) {
      console.log("✅ SUCCESS: User C was promoted from waitlist to confirmed!");
    } else {
      console.log("❌ FAILED: User C was not promoted correctly");
    }
    console.log("================================\n");
    
    res.json({
      success: promotionSuccess,
      test: 'Waitlist Promotion Flow',
      eventId: testEvent.id,
      beforeCancellation: {
        userA: registrationsResult.userA.status,
        userB: registrationsResult.userB.status,
        userC: registrationsResult.userC.status
      },
      afterCancellation: {
        userA: finalStates.rows.find(r => r.user_id === testUsers.testUserA.id)?.status,
        userB: finalStates.rows.find(r => r.user_id === testUsers.testUserB.id)?.status,
        userC: finalStates.rows.find(r => r.user_id === testUsers.testUserC.id)?.status
      },
      promotion: promotionSuccess ? 'User C promoted ✅' : 'Promotion failed ❌'
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Test error:', err);
    res.status(500).json({ error: "Test failed: " + err.message });
  } finally {
    client.release();
  }
});

// AI COPILOT ENDPOINT - Analyze organizer's events
app.post("/api/ai/analyze", authMiddleware, async (req, res) => {
  try {
    const { question } = req.body;
    const organizerId = req.user.id;

    console.log("🤖 AI Copilot request from organizer:", organizerId, "Question:", question);

    // Only organizers and admins can access
    if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Only organizers and admins can access this." });
    }

    // Fetch organizer's events
    const eventsResult = await pool.query(
      "SELECT id, title, description, date, location, total_seats, available_seats FROM events WHERE created_by = $1 ORDER BY date DESC",
      [organizerId]
    );

    const events = eventsResult.rows;
    console.log("📊 Found", events.length, "events for organizer");

    if (events.length === 0) {
      return res.json({
        answer: "You haven't created any events yet. Create your first event to get AI insights!"
      });
    }

    // Get event IDs
    const eventIds = events.map(e => e.id);
    console.log("📌 Event IDs:", eventIds);

    // Fetch registrations for all events
    const registrationsResult = await pool.query(
      `SELECT r.event_id, r.status, COUNT(*) as count
       FROM registrations r
       WHERE r.event_id = ANY($1) AND r.status != 'cancelled'
       GROUP BY r.event_id, r.status
       ORDER BY r.event_id`,
      [eventIds]
    );

    console.log("👥 Registration data:", registrationsResult.rows);

    // Format data for AI
    let eventContext = "### Events Overview:\n\n";
    const eventStats = {};

    events.forEach(event => {
      const confirmed = registrationsResult.rows.find(
        r => r.event_id === event.id && r.status === 'confirmed'
      );
      const waitlisted = registrationsResult.rows.find(
        r => r.event_id === event.id && r.status === 'waitlisted'
      );

      const confirmedCount = confirmed ? parseInt(confirmed.count) : 0;
      const waitlistedCount = waitlisted ? parseInt(waitlisted.count) : 0;
      const fillRate = ((event.total_seats - event.available_seats) / event.total_seats * 100).toFixed(1);

      eventStats[event.id] = {
        title: event.title,
        confirmed: confirmedCount,
        waitlisted: waitlistedCount,
        capacity: event.total_seats,
        fillRate: fillRate
      };

      eventContext += `**${event.title}**\n`;
      eventContext += `- Date: ${new Date(event.date).toLocaleDateString()}\n`;
      eventContext += `- Confirmed Registrations: ${confirmedCount}/${event.total_seats}\n`;
      eventContext += `- Capacity Fill Rate: ${fillRate}%\n`;
      eventContext += `- Waitlisted: ${waitlistedCount}\n\n`;
    });

    const dataContext = eventContext;
    console.log("📝 Data context:\n", dataContext);

    // Initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    console.log("🔑 OpenAI API Key present:", !!apiKey, "Length:", apiKey ? apiKey.length : 0);
    
    if (!apiKey) {
      return res.status(400).json({ error: "OpenAI API key not configured. Please add OPENAI_API_KEY to .env" });
    }

    const client = new OpenAI({
      apiKey: apiKey,
    });

    console.log("🚀 Calling OpenAI API (single attempt)...");

    // Try OpenAI first - single attempt only
    try {
      const response = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are an AI event analytics assistant. Your role is to analyze event data and provide actionable insights for event organizers. Be concise, structured, and helpful. Always provide specific recommendations based on the data provided.",
          },
          {
            role: "user",
            content: `${question}\n\nDATA:\n${dataContext}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const answer = response.choices[0].message.content;
      console.log("✅ OpenAI response received successfully");
      console.log("✨ Using OpenAI for response");
      return res.json({
        answer: answer,
        source: "openai"
      });
    } catch (openaiError) {
      // Detect quota/rate limit errors to potentially skip OpenAI next time
      const isQuotaError = openaiError.status === 429 || 
                          (openaiError.message && openaiError.message.includes("quota"));
      
      if (isQuotaError) {
        console.error("⚠️  OpenAI quota exceeded or rate limited:", openaiError.message);
      } else {
        console.error("⚠️  OpenAI failed:", openaiError.message);
      }

      console.log("🔴 OpenAI failed, switching to Ollama immediately");
      
      // Immediate fallback to Ollama - no delays
      try {
        console.log("🐫 Attempting Ollama connection at http://localhost:11434...");
        
        // First, check if Ollama is reachable
        try {
          const checkRes = await fetch("http://localhost:11434/api/tags", {
            method: "GET",
            timeout: 3000
          });
          
          if (checkRes.ok) {
            const tags = await checkRes.json();
            const modelNames = tags.models ? tags.models.map(m => m.name) : [];
            console.log("✅ Ollama is reachable. Available models:", modelNames);
          } else {
            console.warn("⚠️  Ollama endpoint not responding properly to status check:", checkRes.status);
          }
        } catch (checkErr) {
          console.warn("⚠️  Could not verify Ollama status:", checkErr.message);
        }

        console.log("🐫 Calling Ollama generate endpoint...");
        const ollamaBody = {
          model: "phi",
          prompt: `You are an AI event analytics assistant. Your role is to analyze event data and provide actionable insights for event organizers. Be concise, structured, and helpful. Always provide specific recommendations based on the data provided.

QUESTION: ${question}

DATA:
${dataContext}`,
          stream: false
        };

        console.log("📤 Ollama request body:", JSON.stringify({
          model: ollamaBody.model,
          prompt_length: ollamaBody.prompt.length,
          stream: ollamaBody.stream
        }));

        const ollamaRes = await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(ollamaBody),
          timeout: 30000
        });

        console.log("📥 Ollama response status:", ollamaRes.status);

        if (!ollamaRes.ok) {
          const errorText = await ollamaRes.text();
          console.error(`❌ Ollama HTTP error ${ollamaRes.status}:`, errorText);
          
          if (ollamaRes.status === 404) {
            console.error("💡 404 error - possible causes:");
            console.error("  1. Model 'phi' not found/not pulled in Ollama");
            console.error("  2. Ollama API endpoint path incorrect");
            console.error("  3. Ollama service not fully running");
          }
          
          throw new Error(`Ollama HTTP ${ollamaRes.status}: ${errorText}`);
        }

        const ollamaData = await ollamaRes.json();
        console.log("📝 Ollama response object keys:", Object.keys(ollamaData));
        
        if (!ollamaData.response) {
          console.error("❌ Ollama returned no response field. Response object:", JSON.stringify(ollamaData).substring(0, 200));
          throw new Error("Ollama returned empty response");
        }

        console.log("✅ Response received from Ollama");
        console.log("⚡ Using Ollama for response (Local AI)");
        return res.json({
          answer: ollamaData.response,
          source: "ollama"
        });
      } catch (ollamaError) {
        console.error("🔴 Ollama connection failed:", ollamaError.message);
        console.error("Error details:", ollamaError);

        // Both failed - return graceful message
        console.log("🚨 Both OpenAI and Ollama unavailable");
        return res.json({
          answer: "I apologize, but the AI analysis feature is temporarily unavailable. Both primary and backup AI systems could not be reached. Please try again in a few moments.",
          source: "none",
          isUnavailable: true
        });
      }
    }
  } catch (err) {
    console.error("❌ AI Copilot error:", err);
    console.error("Error message:", err.message);
    console.error("Error status:", err.status);
    console.error("Error type:", err.constructor.name);
    
    // Handle initialization/data fetching errors (not OpenAI/Ollama specific)
    if (err.message && err.message.includes("OPENAI_API_KEY")) {
      return res.status(400).json({ error: "OpenAI API key not configured. Please add OPENAI_API_KEY to .env" });
    }

    // Database or other critical errors
    res.status(500).json({ 
      error: "Error analyzing events. Please try again later.",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ===== BOOKING ENDPOINTS =====

// CREATE BOOKING (Simulated Payment)
app.post("/api/bookings", authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { event_id, ticket_id, responses } = req.body;
    const user_id = req.user.id;

    if (!event_id || !ticket_id) {
      return res.status(400).json({ error: "event_id and ticket_id are required" });
    }

    await client.query('BEGIN');

    // Lock and fetch the event
    const eventRes = await client.query(
      'SELECT * FROM events WHERE id = $1 FOR UPDATE',
      [event_id]
    );

    if (eventRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventRes.rows[0];

    if (!event.is_paid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "This is a free event. Use the registration endpoint instead." });
    }

    // Validate dynamic responses
    const validationError = validateResponses(event.form_fields, responses);
    if (validationError) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: validationError });
    }

    // Lock and fetch the ticket
    const ticketRes = await client.query(
      'SELECT * FROM tickets WHERE id = $1 AND event_id = $2 FOR UPDATE',
      [ticket_id, event_id]
    );

    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Ticket type not found for this event" });
    }

    const ticket = ticketRes.rows[0];

    // Oversell protection
    if (ticket.sold >= ticket.quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "This ticket type is sold out" });
    }

    // Check if user already booked this event
    const existingBooking = await client.query(
      'SELECT * FROM bookings WHERE user_id = $1 AND event_id = $2 AND status = $3',
      [user_id, event_id, 'success']
    );

    if (existingBooking.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "You have already booked a ticket for this event" });
    }

    // Create booking with pending status
    const bookingRes = await client.query(
      `INSERT INTO bookings (user_id, event_id, ticket_id, ticket_type, status, responses)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [user_id, event_id, ticket_id, ticket.name, JSON.stringify(responses || {})]
    );

    const booking = bookingRes.rows[0];

    // Simulate payment success — update booking status
    await client.query(
      'UPDATE bookings SET status = $1 WHERE id = $2',
      ['success', booking.id]
    );

    // Update ticket sold count
    await client.query(
      'UPDATE tickets SET sold = sold + 1 WHERE id = $1',
      [ticket_id]
    );

    // Update event available seats for consistency with existing seat tracking
    if (event.available_seats > 0) {
      await client.query(
        'UPDATE events SET available_seats = available_seats - 1 WHERE id = $1',
        [event_id]
      );
    }

    // Also create a registration entry for consistency with existing system
    const existingReg = await client.query(
      'SELECT * FROM registrations WHERE user_id = $1 AND event_id = $2',
      [user_id, event_id]
    );

    if (existingReg.rows.length === 0) {
      await client.query(
        'INSERT INTO registrations (user_id, event_id, status, responses) VALUES ($1, $2, $3, $4)',
        [user_id, event_id, 'confirmed', JSON.stringify(responses || {})]
      );
    } else if (existingReg.rows[0].status === 'cancelled') {
      await client.query(
        'UPDATE registrations SET status = $1, responses = $2 WHERE user_id = $3 AND event_id = $4',
        ['confirmed', JSON.stringify(responses || {}), user_id, event_id]
      );
    }

    await client.query('COMMIT');

    // Emit real-time update
    io.emit("event:update", {
      type: "BOOKED",
      eventId: event_id,
      userId: user_id,
      ticketType: ticket.name,
      timestamp: new Date()
    });

    res.json({
      booking: { ...booking, status: 'success' },
      ticket: ticket,
      message: "Booking confirmed successfully!"
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Error processing booking" });
  } finally {
    client.release();
  }
});

// GET MY BOOKINGS
app.get("/api/bookings/my", authMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;
    const result = await pool.query(
      `SELECT b.id, b.status, b.ticket_type, b.created_at,
              e.title as event_title, e.date as event_date, e.location as event_location, e.id as event_id,
              t.price as ticket_price
       FROM bookings b
       JOIN events e ON b.event_id = e.id
       JOIN tickets t ON b.ticket_id = t.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching bookings" });
  }
});

// ===== ADMIN ENDPOINTS =====

// GET /api/admin/users - Get all users
app.get("/api/admin/users", adminAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching users" });
  }
});

// GET /api/admin/organizers - Get all organizers
app.get("/api/admin/organizers", adminAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at FROM users WHERE role = 'organizer' ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching organizers" });
  }
});

// GET /api/admin/events - Get all events
app.get("/api/admin/events", adminAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        date, 
        location, 
        total_seats, 
        available_seats, 
        created_by, 
        created_at 
       FROM events 
       ORDER BY date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching events" });
  }
});

// GET /api/admin/registrations - Get all registrations
app.get("/api/admin/registrations", adminAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, 
        user_id, 
        event_id, 
        status, 
        registered_at 
       FROM registrations 
       ORDER BY registered_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching registrations" });
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with Socket.IO support`);
});