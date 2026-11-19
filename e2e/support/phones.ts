import { devices, type Browser, type TestInfo } from "@playwright/test";

/**
 * A second person's phone: a separate browser with its own cookies, so two
 * people can take part in one test.
 */
export async function anotherPhone(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    baseURL: testInfo.project.use.baseURL,
  });
  return context.newPage();
}
