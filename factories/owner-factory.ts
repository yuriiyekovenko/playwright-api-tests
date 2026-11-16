import { faker } from '@faker-js/faker';
import { CreateOwner } from '../types/owners';

export class OwnerFactory {
    /**
     * Names must match a letters-only pattern, so uniqueness comes from a random letter suffix.
     * Telephone is exactly 10 digits (the only length the service accepts).
     */
    static random(): CreateOwner {
        return {
            firstName: faker.string.alpha({ length: 10, casing: 'mixed' }),
            lastName: faker.string.alpha({ length: 12, casing: 'mixed' }),
            address: faker.location.streetAddress(),
            city: faker.location.city(),
            telephone: faker.string.numeric({ length: 10 }),
        };
    }
}
