import { faker } from '@faker-js/faker';
import { CreatePetType } from '../types/pet-types';

export class PetTypeFactory {
    /**
     * Name must match ^[\p{L}][\p{L}\s\-']{0,79}$ (letters only), so uniqueness comes from a random letter suffix.
     */
    static random(): CreatePetType {
        return {
            name: `PetType${faker.string.alpha({ length: 20, casing: 'mixed' })}`,
        };
    }
}
