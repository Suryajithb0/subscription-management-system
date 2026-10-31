const { generateAccessToken, verifyAccessToken } = require('./tokenUtils');

module.exports = {
  generateToken: generateAccessToken,
  verifyToken: verifyAccessToken
};
