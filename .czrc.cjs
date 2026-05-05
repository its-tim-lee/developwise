const { register } = require("tsx/esm/api");

register();

const mod = require("./.czrc.ts");

module.exports = mod.default ?? mod;
