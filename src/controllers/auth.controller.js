import jwt from "jsonwebtoken";

export const login = (req, res) => {
  const { username, password } = req.body;

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "password";

  if (username === adminUsername && password === adminPassword) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET || "supersecretfloristakey", {
      expiresIn: "30d",
    });

    res.status(200).json({
      message: "Login successful",
      token
    });
  } else {
    res.status(401).json({ error: "Invalid username or password" });
  }
};

export const getMe = (req, res) => {
  res.status(200).json({ user: req.user });
};
