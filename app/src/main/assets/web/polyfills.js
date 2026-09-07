// Small built-in compatibility layer for the original Android 8 WebView.
if (typeof window !== "undefined" && !window.globalThis)
  window.globalThis = window;
if (!Object.fromEntries)
  Object.fromEntries = (entries) => {
    const out = {};
    for (const [key, value] of entries)
      Object.defineProperty(out, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    return out;
  };
if (!Array.prototype.at)
  Object.defineProperty(Array.prototype, "at", {
    value: function (index) {
      const n = Math.trunc(index) || 0;
      return this[n < 0 ? this.length + n : n];
    },
    configurable: true,
    writable: true,
  });
if (!Array.prototype.flatMap)
  Object.defineProperty(Array.prototype, "flatMap", {
    value: function (fn, thisArg) {
      return this.reduce(
        (out, value, index) => out.concat(fn.call(thisArg, value, index, this)),
        [],
      );
    },
    configurable: true,
    writable: true,
  });
