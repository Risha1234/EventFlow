const adminAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Check for admin-token specifically
    if (token !== "admin-token") {
      return res.status(403).json({ error: "Invalid admin credentials" });
    }

    // Set a minimal user object for admin
    req.user = { role: "admin", id: "admin" };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Authentication failed" });
  }
};

module.exports = adminAuthMiddleware;
