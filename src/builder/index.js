const APIBuilder = require("./apiBuilder");
var pm = null;
var globCache = null;
/* istanbul ignore next */
try {
  require.resolve("picomatch");
  pm = require("picomatch");
  globCache = {};
} catch (_e) {
  // do nothing
}

function Builder() {
  this.maxDepth = Infinity;
  this.suppressErrors = true;
  this.filters = [];
}

Builder.prototype.crawl = function(path) {
  return new APIBuilder(path, this);
};

Builder.prototype.crawlWithOptions = function(path, options) {
  if (!options.maxDepth) options.maxDepth = Infinity;
  options.groupVar = options.group;
  options.onlyCountsVar = options.onlyCounts;
  options.excludeFn = options.exclude;
  options.filters = options.filters || [];
  return new APIBuilder(path, options);
};

Builder.prototype.withBasePath = function() {
  this.includeBasePath = true;
  return this;
};

Builder.prototype.withDirs = function() {
  this.includeDirs = true;
  return this;
};

Builder.prototype.withMaxDepth = function(depth) {
  this.maxDepth = depth;
  return this;
};

Builder.prototype.withFullPaths = function() {
  this.resolvePaths = true;
  this.includeBasePath = true;
  return this;
};

Builder.prototype.withErrors = function() {
  this.suppressErrors = false;
  return this;
};

Builder.prototype.group = function() {
  this.groupVar = true;
  return this;
};

Builder.prototype.normalize = function() {
  this.normalizePath = true;
  return this;
};

Builder.prototype.filter = function(filterFn) {
  this.filters.push(filterFn);
  return this;
};

Builder.prototype.glob = function(...patterns) {
  /* istanbul ignore next */
  if (!pm) {
    throw new Error(
      `Please install picomatch: "npm i picomatch" to use glob matching.`
    );
  }
  var isMatch = globCache[patterns.join("||")];
  if (!isMatch) {
    isMatch = pm(patterns);
    globCache[patterns.join("||")] = isMatch;
  }
  this.filters.push((path) => isMatch(path));
  return this;
};

Builder.prototype.exclude = function(excludeFn) {
  this.excludeFn = excludeFn;
  return this;
};

Builder.prototype.onlyCounts = function() {
  this.onlyCountsVar = true;
  return this;
};

module.exports = Builder;

function arrEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
