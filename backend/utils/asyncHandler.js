// Express 4 does not catch rejected promises thrown by an `async` route
// handler — they become unhandled rejections, and Node kills the whole
// process on those by default. Wrapping every handler in this forwards the
// error to Express's error middleware instead of taking the server down.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
