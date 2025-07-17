import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { companyLawyersFactory } from "@test/factories/companyLawyers";
import { convertibleSecuritiesFactory } from "@test/factories/convertibleSecurities";
import { dividendsFactory } from "@test/factories/dividends";
import { documentsFactory } from "@test/factories/documents";
import { equityGrantExercisesFactory } from "@test/factories/equityGrantExercises";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { shareClassesFactory } from "@test/factories/shareClasses";
import { shareHoldingsFactory } from "@test/factories/shareHoldings";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import type { companies, companyInvestors, users } from "@/db/schema";

test.describe("People header navigation", () => {
  let company: typeof companies.$inferSelect;
  let companyAdmin: typeof users.$inferSelect;
  let companyInvestor: typeof companyInvestors.$inferSelect;
  let expectedTabs: { name: string; href: string }[];

  test.beforeEach(async () => {
    const onboarding = await companiesFactory.createCompletedOnboarding({
      tenderOffersEnabled: true,
      capTableEnabled: true,
      equityGrantsEnabled: true,
    });
    company = onboarding.company;
    companyAdmin = onboarding.adminUser;

    await companyContractorsFactory.create({
      companyId: company.id,
      userId: companyAdmin.id,
      externalId: companyAdmin.externalId,
    });

    const investor = await companyInvestorsFactory.create({
      companyId: company.id,
      userId: companyAdmin.id,
      externalId: companyAdmin.externalId,
    });
    companyInvestor = investor.companyInvestor;

    await documentsFactory.create({ companyId: company.id });
    const shareClass = (await shareClassesFactory.create({ companyId: company.id })).shareClass;
    await shareHoldingsFactory.create({ companyInvestorId: companyInvestor.id, shareClassId: shareClass.id });
    await equityGrantExercisesFactory.create({ companyInvestorId: companyInvestor.id });
    await equityGrantsFactory.create({ companyInvestorId: companyInvestor.id });
    await dividendsFactory.create({ companyId: company.id, companyInvestorId: companyInvestor.id });
    await convertibleSecuritiesFactory.create({ companyInvestorId: companyInvestor.id });

    expectedTabs = [
      { name: "Shares", href: "?tab=shares" },
      { name: "Exercises", href: "?tab=exercises" },
      { name: "Dividends", href: "?tab=dividends" },
      { name: "Convertibles", href: "?tab=convertibles" },
      { name: "Options", href: "?tab=options" },
    ];
  });

  test("shows the expected tabs for lawyer", async ({ page }) => {
    const companyLawyer = (await usersFactory.create()).user;
    await companyLawyersFactory.create({ companyId: company.id, userId: companyLawyer.id });
    await login(page, companyLawyer);
    await page.goto(`/people/${companyInvestor.externalId}`);

    await expect(page.getByRole("tab", { name: "Details" })).not.toBeVisible();
    for (const { name, href } of expectedTabs) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
      await expect(page.getByRole("tab", { name })).toHaveAttribute("href", href);
    }
  });

  test("shows the expected tabs for company administrator", async ({ page }) => {
    await login(page, companyAdmin);
    await page.goto(`/people/${companyInvestor.externalId}`);

    const adminExpectedTabs = [...expectedTabs, { name: "Details", href: "?tab=details" }];
    for (const { name, href } of adminExpectedTabs) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
      await expect(page.getByRole("tab", { name })).toHaveAttribute("href", href);
    }
  });
});
