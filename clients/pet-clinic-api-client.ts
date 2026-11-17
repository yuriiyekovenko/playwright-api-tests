import { APIRequestContext } from '@playwright/test';
import { OwnersAPIClient } from './owners-api-client';
import { PetsAPIClient } from './pets-api-client';
import { PetTypesAPIClient } from './pet-types-api-client';

export class PetClinicAPIClient {
    readonly petTypes: PetTypesAPIClient;
    readonly owners: OwnersAPIClient;
    readonly pets: PetsAPIClient;

    constructor(request: APIRequestContext) {
        this.petTypes = new PetTypesAPIClient(request);
        this.owners = new OwnersAPIClient(request);
        this.pets = new PetsAPIClient(request);
    }
}
