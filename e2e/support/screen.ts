import type { Page } from "@playwright/test";

/** Page wording the tests look for in more than one file. */
export const NOT_FOUND = "We couldn't find that page";

/**
 * The error message a form is showing. Scoped to the page's main content,
 * because Next's route announcer is also role="alert".
 */
export function formError(page: Page) {
  return page.getByRole("main").getByRole("alert");
}

/** The opening's stance field. */
export const STANCE = "Where do you stand?";
