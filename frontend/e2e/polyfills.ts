
console.log("Polyfilling localStorage...");
if (
  typeof global !== "undefined" &&
  (!global.localStorage || typeof (global as any).localStorage?.getItem !== "function")
) {
    class LocalStoragePolyfill {
        private store: Map<string, string>;

        constructor() {
            this.store = new Map();
        }

        getItem(key: string): string | null {
            return this.store.get(key) ?? null;
        }

        setItem(key: string, value: string): void {
            this.store.set(key, value);
        }

        removeItem(key: string): void {
            this.store.delete(key);
        }

        clear(): void {
            this.store.clear();
        }

        get length(): number {
            return this.store.size;
        }

        key(index: number): string | null {
            const keys = Array.from(this.store.keys());
            return keys[index] ?? null;
        }
    }

    (global as any).localStorage = new LocalStoragePolyfill();
    (global as any).sessionStorage = new LocalStoragePolyfill();
}
