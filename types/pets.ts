import type { PetType } from './pet-types';

export interface CreatePet {
    name: string;
    birthDate: string;
    type: PetType;
}

export interface Pet extends CreatePet {
    id: number;
    ownerId: number;
    visits: unknown[];
}
