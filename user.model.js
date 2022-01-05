const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  email: String,
  fullName: String,
  password: String,
});

module.exports = mongoose.model("user", schema);
