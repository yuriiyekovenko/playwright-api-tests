import { APIRequestContext } from '@playwright/test';
import { OwnersAPIClient } from './owners-api-client';
import { PetTypesAPIClient } from './pet-types-api-client';

export class PetClinicAPIClient {
    readonly petTypes: PetTypesAPIClient;
    readonly owners: OwnersAPIClient;

    constructor(request: APIRequestContext) {
        this.petTypes = new PetTypesAPIClient(request);
        this.owners = new OwnersAPIClient(request);
    }
}
