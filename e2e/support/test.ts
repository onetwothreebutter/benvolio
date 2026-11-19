import { devices, expect, test as base, type Page } from "@playwright/test";

export { expect };

/**
 * `test` with `anotherPhone()`: a second person's phone, a separate browser
 * with its own cookies, so two people can take part in one test. Closed when
 * the test ends.
 */
export const test = base.extend<{ anotherPhone: () => Promise<Page> }>({
  anotherPhone: async ({ browser, baseURL }, provide) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await provide(async () => {
      const context = await browser.newContext({ ...devices["Pixel 7"], baseURL });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});
