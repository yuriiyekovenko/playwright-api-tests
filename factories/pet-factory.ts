import { faker } from '@faker-js/faker';
import type { CreatePet } from '../types/pets';
import type { PetType } from '../types/pet-types';

export class PetFactory {
    /**
     * Unique short name (<= 30 chars) and a birth date 2 days..5 years in the past, which stays inside
     * the service's undocumented rules (not in the future, not older than 50 years). `type` must carry both id and name.
     */
    static random(type: PetType): CreatePet {
        const date = faker.date.past({ years: 5, refDate: new Date(Date.now() - 2 * 86_400_000) });
        return {
            name: `Pet${faker.string.alpha({ length: 12, casing: 'mixed' })}`,
            birthDate: date.toISOString().slice(0, 10),
            type,
        };
    }
}
