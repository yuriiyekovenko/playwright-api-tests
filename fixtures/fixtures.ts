import { test as base } from '@playwright/test';
import { PetClinicAPIClient } from '../clients/pet-clinic-api-client';
import { CleanupRegistry } from '../utils/cleanup-registry';

export { expect } from '@playwright/test';

type TestFixtures = {
    client: PetClinicAPIClient;
};

export const test = base.extend<TestFixtures>({
    /** Test-scoped client; everything it created is deleted (newest first) after the test. */
    client: async ({ request }, use) => {
        const cleanup = new CleanupRegistry();
        await use(new PetClinicAPIClient(request, cleanup));
        await cleanup.runAll();
    },
});
