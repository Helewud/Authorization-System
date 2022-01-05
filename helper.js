const jwt = require("jsonwebtoken");
const createError = require("http-errors");
const redisClient = require("./config/redisCache");

//                                                    //
//                 Generate JWT                       //
//////////////////              ////////////////////////
module.exports.generateJWT = (payload, expiry) => {
  return jwt.sign(payload, "theSecretKey", {
    expiresIn: expiry,
  });
};

//                                                    //
//                 Verify JWT                         //
//////////////////              ////////////////////////
module.exports.verifyJWT = (token) => {
  return jwt.verify(token, "theSecretKey");
};

//                                                    //
//             Add valid JWT to cache                 //
//////////////////              ////////////////////////
module.exports.addToken = async (id, token) => {
  const key = `${id}_${token}`;
  const check = await redisClient.EXISTS(key); // check if key exists in cache
  if (check == 1) return createError(500, "Cache error");

  await redisClient.SET(key, "valid"); // set key value to be 'valid'
  const payload = this.verifyJWT(token); // verify and decode the JWT
  await redisClient.EXPIREAT(key, +payload.exp); // set expiry date for the key in the cache
  return;
};

//                                                    //
//               Check JWT validity                   //
//////////////////              ////////////////////////
module.exports.checkToken = async (id, token) => {
  const key = `${id}_${token}`;
  const status = redisClient.GET(key); // get the token from the cache and return its value
  return status;
};

//                                                    //
//                 Invalidate JWT                     //
//////////////////              ////////////////////////
module.exports.blacklistToken = async (id, token) => {
  const key = `${id}_${token}`;
  const status = await redisClient.SET(key, "invalid"); // set key value to be 'invalid'
  if (status == "nil") return createError(404, "Token doesn't exist");
  const payload = this.verifyJWT(token); // verify and decode the JWT
  await redisClient.EXPIREAT(key, +payload.exp); // sets the token expiration date to be removed from the cache
  return;
};

//                                                    //
//                 Invalidate all JWT                 //
//               that belongs to a user               //
//////////////////              ////////////////////////
module.exports.blacklistAllToken = async (id, token) => {
  for await (const key of redisClient.scanIterator({
    //
    MATCH: `${id}*`,
  })) {
    await redisClient.set(key, "invalid");
    const payload = this.verifyJWT(token); // verify and decode the JWT
    await redisClient.EXPIREAT(key, +payload.exp);
  }

  return;
};
