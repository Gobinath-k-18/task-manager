const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;

  if (!name || !email || typeof password !== "string" || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  if (!emailPattern.test(email)) {
    return res.status(400).json({ message: "A valid email address is required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  let client;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [email]);

    const existingUser = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [email],
    );

    if (existingUser.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const result = await client.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, passwordHash],
    );

    await client.query("COMMIT");
    return res.status(201).json({
      message: "Registration successful",
      user: result.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The connection may already have rolled back or been released by PostgreSQL.
      }
    }

    return res.status(500).json({ message: "Unable to register user" });
  } finally {
    client?.release();
  }
}

async function login(req, res) {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;

  if (!email || typeof password !== "string" || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, email, password FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [email],
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET === "replace_with_a_secure_random_secret"
    ) {
      return res.status(500).json({ message: "Authentication is not configured" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to log in" });
  }
}

module.exports = { register, login };