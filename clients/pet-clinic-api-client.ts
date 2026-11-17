import { APIRequestContext } from '@playwright/test';
import type { CleanupRegistry } from '../utils/cleanup-registry';
import { OwnersAPIClient } from './owners-api-client';
import { PetsAPIClient } from './pets-api-client';
import { PetTypesAPIClient } from './pet-types-api-client';

export class PetClinicAPIClient {
    readonly petTypes: PetTypesAPIClient;
    readonly owners: OwnersAPIClient;
    readonly pets: PetsAPIClient;

    /** `cleanup` is optional: tests get it from the `client` fixture; non-test callers (e.g. seeding scripts) may omit it. */
    constructor(request: APIRequestContext, cleanup?: CleanupRegistry) {
        this.petTypes = new PetTypesAPIClient(request, cleanup);
        this.owners = new OwnersAPIClient(request, cleanup);
        this.pets = new PetsAPIClient(request, cleanup);
    }
}
