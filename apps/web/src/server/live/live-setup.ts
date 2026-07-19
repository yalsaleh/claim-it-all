/**
 * Runs before each live test file so the product Prisma singleton and fixture
 * clients share INTEGRATION_DATABASE_URL (never a stray apps/web/.env DATABASE_URL).
 */
const integrationUrl = process.env.INTEGRATION_DATABASE_URL;
if (integrationUrl) {
  process.env.DATABASE_URL = integrationUrl;
}
