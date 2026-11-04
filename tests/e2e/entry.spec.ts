import { expect, test } from "@playwright/test";

test.skip(
  !process.env.DATABASE_URL,
  "Configure DATABASE_URL and apply migrations to run authenticated-app browser tests.",
);

test("the public entry point directs signed-out users to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Välkommen tillbaka" })).toBeVisible();
  await expect(page.getByLabel("E-postadress")).toBeVisible();
});
