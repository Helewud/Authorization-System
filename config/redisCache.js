const redis = require("redis");

class Redis {
  constructor() {
    this.connected = false;
    this.client = null;
  }

  getConnection() {
    if (this.connected) return this.client;

    this.client = redis.createClient();

    this.client.on("connect", (err) => {
      console.log("Client connected to Redis...");
    });
    this.client.on("ready", (err) => {
      console.log("Redis ready to use");
    });
    this.client.on("error", (err) => {
      console.error("Redis Client", err);
    });
    this.client.on("end", () => {
      console.log("Redis disconnected successfully");
    });

    return this.client;
  }
}

module.exports = new Redis().getConnection();
