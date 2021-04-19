const { sep, resolve: pathResolve } = require("path");
const { cleanPath } = require("../utils");
const fns = require("./fns");
const readdirOpts = { withFileTypes: true };

function Walker(options, callback) {
  /* Dummy functions that will be filled later conditionally based on options */
  this.pushFile = fns.empty;
  this.pushDir = fns.empty;
  this.walkDir = fns.empty;
  this.joinPath = fns.empty;
  this.groupFiles = fns.empty;
  this.callbackInvoker = fns.empty;
  this.getArray = fns.empty;
  this.symlinkResolver = fns.empty;

  this.options = options;

  /* Perf: We use a local state per walker instead of direct global variables
   * so that each walker execution is independent.
   */
  this.state = {
    // Perf: we explicitly tell the compiler to optimize for String arrays
    paths: [""].slice(0, 0),
    counts: { files: 0, dirs: 0 },
    options,
    callback,
  };

  /*
   * Perf: We conditionally change functions according to options. This gives a slight
   * performance boost. Since these functions are so small, they are automatically inlined
   * by the javascript engine so there's no function call overhead (in most cases).
   */
  this.buildFunctions();
}

Walker.prototype.normalizePath = function normalizePath(path) {
  if (this.options.resolvePaths) path = pathResolve(path);
  if (this.options.normalizePath) path = cleanPath(path);
  return path;
};

Walker.prototype.registerWalker = function registerWalker(walkerFunction) {
  this.walk = walkerFunction;
};

Walker.prototype.processDirents = function processDirents(
  directoryPath,
  dirents,
  currentDepth
) {
  this.pushDir(this, directoryPath, this.state.paths);

  // in cases where we have / as path
  if (directoryPath === sep) directoryPath = "";

  const files = this.getArray(this.state);

  for (var i = 0; i < dirents.length; ++i) {
    const dirent = dirents[i];

    if (dirent.isFile()) {
      const filename = this.joinPath(dirent.name, directoryPath);
      this.pushFile(this, filename, files);
    } else if (dirent.isDirectory()) {
      let path = `${directoryPath}${sep}${dirent.name}`;
      this.walkDir(this, path, dirent.name, currentDepth - 1);
    }
    // perf: we can avoid entering the condition block if .withSymlinks is not set
    // by using symlinkResolver !== fns.empty; this helps us avoid wasted allocations
    // which are probably very minor
    else if (dirent.isSymbolicLink() && this.symlinkResolver !== fns.empty) {
      let path = `${directoryPath}${sep}${dirent.name}`;
      this.symlinkResolver(path, this.state, (stat, resolvedPath) => {
        if (stat.isFile()) {
          this.pushFile(this, resolvedPath, files);
        } else if (stat.isDirectory()) {
          this.walkDir(this, resolvedPath, dirent.name, currentDepth - 1);
        }
      });
    }
  }

  this.groupFiles(directoryPath, files, this.state);
};

Walker.prototype.buildFunctions = function buildFunctions() {
  const {
    filters,
    onlyCountsVar,
    includeBasePath,
    includeDirs,
    groupVar,
    excludeFn,
    excludeFiles,
    resolveSymlinks,
    isSync,
  } = this.options;

  this.buildPushFile(filters, onlyCountsVar, excludeFiles);

  this.pushDir = includeDirs
    ? filters.length
      ? fns.pushDirFilter
      : fns.pushDir
    : fns.empty;

  // build function for joining paths
  this.joinPath = includeBasePath ? fns.joinPathWithBasePath : fns.joinPath;

  // build recursive walk directory function
  this.walkDir = excludeFn ? fns.walkDirExclude : fns.walkDir;

  // build groupFiles function for grouping files
  this.groupFiles = groupVar ? fns.groupFiles : fns.empty;
  this.getArray = groupVar ? fns.getArrayGroup : fns.getArray;

  this.buildSymlinkResolver(resolveSymlinks, isSync);

  this.buildCallbackInvoker(onlyCountsVar, isSync);
};

Walker.prototype.buildPushFile = function buildPushFile(
  filters,
  onlyCountsVar,
  excludeFiles
) {
  if (excludeFiles) {
    this.pushFile = fns.empty;
    return;
  }

  if (filters.length && onlyCountsVar) {
    this.pushFile = fns.pushFileFilterAndCount;
  } else if (filters.length) {
    this.pushFile = fns.pushFileFilter;
  } else if (onlyCountsVar) {
    this.pushFile = fns.pushFileCount;
  } else {
    this.pushFile = fns.pushFile;
  }
};

Walker.prototype.buildCallbackInvoker = function buildCallbackInvoker(
  onlyCountsVar,
  isSync
) {
  if (onlyCountsVar) {
    this.callbackInvoker = isSync
      ? fns.callbackInvokerOnlyCountsSync
      : fns.callbackInvokerOnlyCountsAsync;
  } else {
    this.callbackInvoker = isSync
      ? fns.callbackInvokerDefaultSync
      : fns.callbackInvokerDefaultAsync;
  }
};

Walker.prototype.buildSymlinkResolver = function buildSymlinkResolver(
  resolveSymlinks,
  isSync
) {
  if (!resolveSymlinks) return;

  this.symlinkResolver = isSync
    ? fns.resolveSymlinksSync
    : fns.resolveSymlinksAsync;
};

module.exports = { Walker, readdirOpts };