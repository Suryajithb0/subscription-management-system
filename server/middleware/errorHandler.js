// Centralized Error Handling Middleware
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  console.error(`[Error] ${req.method} ${req.url}:`, err.message);

  // Guard against exposing raw database internal error details to clients
  const isDbError = err.code && (err.code.startsWith('ER_') || err.sqlState || err.sql);
  const clientMessage = isDbError && process.env.NODE_ENV === 'production'
    ? 'A database error occurred. Please try again later.'
    : (isDbError ? 'A database error occurred while processing your request.' : (err.message || 'Internal Server Error'));

  res.status(statusCode).json({
    success: false,
    message: clientMessage
  });
};

module.exports = { errorHandler };
