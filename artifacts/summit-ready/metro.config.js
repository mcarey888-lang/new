const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url === "/" || req.url === "/mobile/" || (req.url && !req.url.includes("."))) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
