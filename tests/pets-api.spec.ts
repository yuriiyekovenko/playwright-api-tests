import { request as playwrightRequest } from '@playwright/test';
import { test as base, expect } from '../fixtures/fixtures';
import { OwnerFactory } from '../factories/owner-factory';
import { PetFactory } from '../factories/pet-factory';
import type { PetType } from '../types/pet-types';
import type { Owner } from '../types/owners';
import type { Pet } from '../types/pets';
import { env } from '../config/env';

const NON_EXISTING_ID = 2147483647;

type PetsFixtures = {
    /** Fresh owner per test; it and its pets are removed by the client's cleanup after the test. */
    owner: Owner;
    /** Two existing pet types, read-only. */
    petTypes: [PetType, PetType];
};

const test = base.extend<PetsFixtures>({
    petTypes: async ({ client }, use) => {
        const [first, second] = await client.petTypes.getAll();
        expect(second, 'Pets tests need at least 2 existing pet types').toBeDefined();
        await use([first, second]);
    },
    owner: async ({ client }, use) => {
        await use(await client.owners.create(OwnerFactory.random()));
    },
});

// ---------- Create ----------

test('PET-C-01 Create pet with valid data and read it back', async ({
    client,
    owner,
    petTypes,
}) => {
    const payload = PetFactory.random(petTypes[0]);
    const response = await client.pets.createRaw(owner.id, payload);
    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');
    const pet = (await response.json()) as Pet;
    expect(pet).toEqual({ ...payload, id: expect.any(Number), ownerId: owner.id, visits: [] });
    expect(await client.pets.get(pet.id)).toEqual(pet);
});

test('PET-C-02 Server-assigned id, ownerId and visits are ignored in payload', async ({
    client,
    owner,
    petTypes,
}) => {
    const payload = {
        ...PetFactory.random(petTypes[0]),
        id: 99999,
        ownerId: NON_EXISTING_ID,
        visits: [{ description: 'x' }],
    };
    const response = await client.pets.createRaw(owner.id, payload);
    expect(response.status()).toBe(201);
    const pet = (await response.json()) as Pet;
    expect(pet.id).not.toBe(99999);
    expect(pet.ownerId).toBe(owner.id);
    expect(pet.visits).toEqual([]);
});

test('PET-C-04 Create pet with 30-character name', async ({ client, owner, petTypes }) => {
    const payload = { ...PetFactory.random(petTypes[0]), name: 'a'.repeat(30) };
    const pet = await client.pets.create(owner.id, payload);
    expect(pet.name).toBe(payload.name);
    expect((await client.pets.get(pet.id)).name).toBe(payload.name);
});

// ---------- Get ----------

test('PET-G-01 Get existing pet', async ({ client, owner, petTypes }) => {
    const payload = PetFactory.random(petTypes[0]);
    const created = await client.pets.create(owner.id, payload);
    const response = await client.pets.getRaw(created.id);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
        ...payload,
        id: created.id,
        ownerId: owner.id,
        visits: [],
    });
});

// ---------- List ----------

test('PET-L-01 v1 list contains the created pet and every item has the Pet shape', async ({
    client,
    owner,
    petTypes,
}) => {
    const created = await client.pets.create(owner.id, PetFactory.random(petTypes[0]));
    const pets = await client.pets.getAll();
    expect(Array.isArray(pets)).toBe(true);
    expect(pets.find((p) => p.id === created.id)).toEqual(created);
    for (const pet of pets) {
        expect(pet).toEqual({
            id: expect.any(Number),
            name: expect.any(String),
            birthDate: expect.any(String),
            type: { id: expect.any(Number), name: expect.any(String) },
            ownerId: expect.any(Number),
            visits: expect.any(Array),
        });
    }
});

// ---------- Update by id ----------

test('PET-U-01 Update all fields of a pet is persisted', async ({ client, owner, petTypes }) => {
    const created = await client.pets.create(owner.id, PetFactory.random(petTypes[0]));
    const update = PetFactory.random(petTypes[1]);
    const response = await client.pets.updateRaw(created.id, update);
    expect(response.status()).toBe(204);
    expect(await response.text()).toBe('');
    const expected = { ...update, id: created.id, ownerId: owner.id, visits: [] };
    expect(await client.pets.get(created.id)).toEqual(expected);
    expect(await client.pets.getOwnersPet(owner.id, created.id)).toEqual(expected);
});

test('PET-D-01 Delete existing pet and it is gone', async ({ client, owner, petTypes }) => {
    const created = await client.pets.create(owner.id, PetFactory.random(petTypes[0]));
    const response = await client.pets.deleteRaw(created.id);
    expect(response.status()).toBe(204);
    expect(await response.text()).toBe('');
    expect((await client.pets.getRaw(created.id)).status()).toBe(404);
    expect((await client.pets.getOwnersPetRaw(owner.id, created.id)).status()).toBe(404);
});

test("PET-O-01 Get owner's pet equals GET by id", async ({ client, owner, petTypes }) => {
    const created = await client.pets.create(owner.id, PetFactory.random(petTypes[0]));
    const response = await client.pets.getOwnersPetRaw(owner.id, created.id);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(await client.pets.get(created.id));
});

test('PET-O-03 Update pet via owner path', async ({ client, owner, petTypes }) => {
    const created = await client.pets.create(owner.id, PetFactory.random(petTypes[0]));
    const update = PetFactory.random(petTypes[1]);
    const response = await client.pets.updateOwnersPetRaw(owner.id, created.id, update);
    expect(response.status()).toBe(204);
    expect(await response.text()).toBe('');
    expect(await client.pets.get(created.id)).toEqual({
        ...update,
        id: created.id,
        ownerId: owner.id,
        visits: [],
    });
});

// ---------- Authentication ----------

test.describe('PET-A-01 Pet operations require valid credentials', () => {
    const base = '/petclinic/api';
    const operations: { name: string; method: 'get' | 'post' | 'put' | 'delete'; path: string }[] =
        [
            { name: 'listPets', method: 'get', path: `${base}/pets` },
            { name: 'listPetsPage', method: 'get', path: `${base}/v2/pets` },
            { name: 'getPet', method: 'get', path: `${base}/pets/{pet}` },
            { name: 'updatePet', method: 'put', path: `${base}/pets/{pet}` },
            { name: 'deletePet', method: 'delete', path: `${base}/pets/{pet}` },
            { name: 'addPetToOwner', method: 'post', path: `${base}/owners/{owner}/pets` },
            { name: 'getOwnersPet', method: 'get', path: `${base}/owners/{owner}/pets/{pet}` },
            { name: 'updateOwnersPet', method: 'put', path: `${base}/owners/{owner}/pets/{pet}` },
        ];
    const credentials = {
        'no credentials': undefined,
        'wrong password': {
            username: env.apiAdminUsername,
            password: `${env.apiAdminPassword}-wrong`,
            send: 'always' as const,
        },
    };

    for (const [label, httpCredentials] of Object.entries(credentials)) {
        for (const op of operations) {
            test(`PET-A-01 ${op.name} returns 401 with ${label}`, async ({
                client,
                owner,
                petTypes,
            }) => {
                const pet = await client.pets.create(owner.id, PetFactory.random(petTypes[0]));
                const anonymous = await playwrightRequest.newContext({
                    baseURL: env.apiBaseUrl,
                    httpCredentials,
                });
                try {
                    const path = op.path
                        .replace('{owner}', String(owner.id))
                        .replace('{pet}', String(pet.id));
                    const data =
                        op.method === 'put' || op.method === 'post'
                            ? PetFactory.random(petTypes[1])
                            : undefined;
                    const response = await anonymous[op.method](path, { data });
                    expect(response.status()).toBe(401);
                } finally {
                    await anonymous.dispose();
                }
                // Mutating calls must not have changed or removed the pet.
                expect(await client.pets.get(pet.id)).toEqual(pet);
            });
        }
    }
});
