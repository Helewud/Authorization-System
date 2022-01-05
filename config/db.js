const mongoose = require("mongoose");

const server = "mongodb://localhost:27017/Auth";
const dbServer = async () => {
  await mongoose.connect(server, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("Database connected succesfully");
};

dbServer().catch((err) => console.log(err));

module.exports = dbServer;
