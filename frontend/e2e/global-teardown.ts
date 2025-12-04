/**
 * Playwright global teardown
 *
 * MSW is currently not started in globalSetup; keep teardown as a no-op
 * to avoid importing MSW in this isolated process.
 */
export default async function globalTeardown() {
  // no-op
}
