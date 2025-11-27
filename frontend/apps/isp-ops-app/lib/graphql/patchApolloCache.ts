// @ts-nocheck
import { InMemoryCache } from "@apollo/client";

const PATCH_FLAG = Symbol.for("dotmac.apolloCache.diffPatched");
const cacheConstructor = InMemoryCache as unknown as Record<symbol, boolean>;

if (!cacheConstructor[PATCH_FLAG]) {
  cacheConstructor[PATCH_FLAG] = true;
  const originalDiff = InMemoryCache.prototype.diff;
  const patchedDiff: typeof originalDiff = function patchedDiff(this: InMemoryCache, options) {
    if (options && Object.prototype.hasOwnProperty.call(options, "canonizeResults")) {
      const { canonizeResults: _removed, ...rest } = options as typeof options & {
        canonizeResults?: boolean;
      };
      return originalDiff.call(this, rest);
    }
    return originalDiff.call(this, options);
  };

  InMemoryCache.prototype.diff = patchedDiff;
}
