import { test as base } from '@playwright/test';
import { PetClinicAPIClient } from '../clients/pet-clinic-api-client';

export { expect } from '@playwright/test';

type TestFixtures = {
    client: PetClinicAPIClient;
};

export const test = base.extend<TestFixtures>({
    client: async ({ request }, use) => {
        await use(new PetClinicAPIClient(request));
    },
});
