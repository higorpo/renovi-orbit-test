import { expect, type Locator, type Page } from "@playwright/test";
import { E2E_FEED_JOB_TITLE, E2E_FEED_SR_ID } from "../mocks/provider-feed.mock";
import { getServiceDetailPath } from "../../src/features/view-services/constants/routes";

export class ProviderJobsPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto("/dashboard/jobs");
  }

  get heading() {
    return this.page.getByRole("heading", { name: "Trabalhos" });
  }

  get jobsList() {
    return this.page.getByLabel("Lista de trabalhos");
  }

  get emptyState() {
    return this.page.getByText(/nenhuma oportunidade na sua região/i);
  }

  jobCard(title: string | RegExp = E2E_FEED_JOB_TITLE): Locator {
    return this.jobsList.getByRole("heading", { name: title });
  }

  get dismissButton() {
    return this.page.getByRole("button", { name: "Não tenho interesse" });
  }

  get viewDetailsLink() {
    return this.page.getByRole("link", { name: "Ver detalhes" });
  }

  get titleDetailLink() {
    return this.page.getByRole("link", {
      name: new RegExp(`Ver detalhes:\\s*${E2E_FEED_JOB_TITLE}`, "i"),
    });
  }

  serviceDetailPath() {
    return getServiceDetailPath(E2E_FEED_SR_ID);
  }

  async expectEmptyFeed() {
    await expect(this.emptyState).toBeVisible({ timeout: 15_000 });
    await expect(this.jobCard()).toHaveCount(0);
  }

  async expectVisibleOpportunity() {
    await expect(this.jobCard()).toBeVisible({ timeout: 15_000 });
  }

  async dismissCurrentOpportunity() {
    await this.dismissButton.click();
    await expect(this.jobCard()).toHaveCount(0, { timeout: 10_000 });
  }

  async openServiceDetailViaLink() {
    await this.page.getByRole("link", { name: "Ver detalhes", exact: true }).click();
    await expect(this.page).toHaveURL(new RegExp(`${this.serviceDetailPath()}$`));
    await expect(
      this.page.getByRole("heading", { name: E2E_FEED_JOB_TITLE }),
    ).toBeVisible({ timeout: 15_000 });
  }

  get loadMoreButton() {
    return this.page.getByRole("button", { name: "Carregar mais" });
  }

  sortTab(name: string | RegExp) {
    return this.page.getByRole("tab", { name });
  }

  jobCards() {
    return this.jobsList.getByRole("heading", { name: /Job paginado E2E/i });
  }

  async expectJobCount(count: number) {
    await expect(this.jobCards()).toHaveCount(count, { timeout: 15_000 });
  }

  async loadMore() {
    await this.loadMoreButton.click();
  }

  async expectUniquePaginatedJobs(expectedCount: number) {
    await this.expectJobCount(expectedCount);
    const titles = await this.jobCards().allTextContents();
    expect(new Set(titles).size).toBe(expectedCount);
  }
}
