const express = require("express");
const createError = require("http-errors");
const logger = require("morgan");
const argon2 = require("argon2");

require("./config/db");
const redis = require("./config/redisCache");
const helper = require("./helper");

const User = require("./user.model");

(async () => {
  await redis.connect();
  return redis;
})();

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.post("/register", async (req, res) => {
  const { password } = req.body;

  const hash = await argon2.hash(password); // hashing the user password
  req.body.password = hash; // updating the password field to the hashed version

  const user = new User(req.body); // creating a user object from our schema class
  await user
    .save() // persist user to database
    .catch((err) => next(createError(500, err.message)));
  res.status(201).json({
    message: "User saved successfully",
  });
});

app.post("/login", async (req, res, next) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email }); // query the database for the user
  if (!user) return next(createError(404, "User record not found"));
  const match = await argon2
    .verify(user.password, password) // compare password with the hash
    .catch((err) => next(createError(500, err.message)));
  if (!match) return next(createError(400, "Incorrect user details"));

  const accessToken = helper.generateJWT({ id: user.id }, "5m"); // generate JWT
  const refreshToken = helper.generateJWT({ id: user.id }, "12h");

  await helper.addToken(user.id, accessToken); // add JWT to checklist

  await helper.addToken(user.id, refreshToken);

  res.status(201).json({
    message: "Login successful",
    body: {
      id: user.id,
      accessToken: accessToken,
      refreshToken: refreshToken,
    },
  });
});

app.post("/logout/:id", async (req, res, next) => {
  const id = req.params.id;
  const authHeader = req.headers.authorization; // extracting the token from the header
  if (!authHeader) {
    return next(createError(400, "Missing authorization header"));
  }
  const accessToken = authHeader.split(" ")[1]; // extracting the bearer token

  await helper.blacklistToken(id, accessToken); // Blacklist JWT

  res.status(200).json({
    message: "Logout successful",
  });
});

app.get("/resources/:id", async (req, res, next) => {
  const id = req.params.id;
  const authHeader = req.headers.authorization; // extracting the token from the header
  if (!authHeader) {
    return next(createError(400, "Missing authorization header"));
  }
  const accessToken = authHeader.split(" ")[1]; // extracting the bearer token

  const temp = await helper.checkToken(id, accessToken); // check token validity
  if (temp === "nil") {
    return next(createError(500, "Refresh token cache error"));
  }
  if (temp === "invalid") {
    return next(createError(401, "User should re-login"));
  }

  try {
    await helper.verifyJWT(accessToken); // verify JWT
  } catch (e) {
    return next(createError(401, e.message));
  }

  res.status(200).send("Hello! Welcome to the protected backend archive.");
});

app.get("/refresh/:id", async (req, res, next) => {
  const id = req.params.id;
  const authHeader = req.headers.authorization; // extracting the token from the header
  if (!authHeader) {
    return next(createError(400, "Missing authorization header"));
  }
  const refToken = authHeader.split(" ")[1]; // extracting the bearer token
  const temp = await helper.checkToken(id, refToken); // check token validity
  if (temp === "nil") {
    return next(createError(500, "Refresh token cache error"));
  }
  if (temp === "invalid") {
    await helper.blacklistAllToken(id, refToken); // blacklist all access and refresh token identifiable with a user
    return next(createError(401, "User should re-login"));
  }

  try {
    helper.verifyJWT(refToken); // verify JWT
    await helper.blacklistToken(id, refToken); // blacklist refresh token
  } catch (e) {
    return next(createError(401, e.message));
  }

  const accessToken = helper.generateJWT({ id: id }, "5m"); // generate JWT
  const refreshToken = helper.generateJWT({ id: id }, "12h");

  await helper.addToken(id, accessToken); // add JWT to checklist
  await helper.addToken(id, refreshToken);

  res.status(201).json({
    message: "Tokens generated successfully",
    body: {
      id: id,
      accessToken: accessToken,
      refreshToken: refreshToken,
    },
  });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.send(err);
});

// Server
const port = "8800";
const host = "localhost";

app.listen(port, host, () => {
  console.log(`Auth app running at ${host}:${port}`);
});

module.exports = app;
