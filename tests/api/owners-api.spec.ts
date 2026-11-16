import type { APIResponse } from '@playwright/test';
import { test, expect } from '../../fixtures/fixtures';
import { OwnerFactory } from '../../factories/owner-factory';
import type { PetClinicAPIClient } from '../../clients/pet-clinic-api-client';
import type { CreateOwner } from '../../types/owners';

const NON_EXISTING_ID = 2147483647;
const REQUIRED_FIELDS = ['firstName', 'lastName', 'address', 'city', 'telephone'] as const;

/* Owners created by the current test; removed afterwards. Only own data is ever deleted.
 Even if these tests are executed concurrently with multiple workers, they have separate createdOwnerIds in every worker so no collisions happen.
 */
const createdOwnerIds: number[] = [];

test.afterEach(async ({ client }) => {
    for (const id of createdOwnerIds.splice(0)) {
        await client.owners.deleteRaw(id);
    }
});

async function createOwner(client: PetClinicAPIClient, payload: CreateOwner) {
    const owner = await client.owners.create(payload);
    createdOwnerIds.push(owner.id);
    return owner;
}

// Raw create that registers the owner for cleanup whenever the service returns 201 (expected or not).
async function createOwnerRaw(client: PetClinicAPIClient, payload: unknown) {
    const response = await client.owners.createRaw(payload);
    if (response.status() === 201) {
        createdOwnerIds.push((await response.json()).id);
    }
    return response;
}

async function expectValidationError(response: APIResponse, ...fields: string[]) {
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
        status: 400,
        detail: 'The request contains invalid or missing parameters',
    });
    expect(
        Array.isArray(body.schemaValidationErrors),
        `schemaValidationErrors must be an array, body: ${JSON.stringify(body)}`,
    ).toBe(true);
    const actual = body.schemaValidationErrors.map((e: { field: string }) => e.field);
    expect(actual).toEqual(expect.arrayContaining(fields));
}

// ---------- Create ----------

test('OWN-C-01 Create owner with valid data', async ({ client }) => {
    const payload = OwnerFactory.random();
    const response = await createOwnerRaw(client, payload);
    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');
    const owner = await response.json();
    expect(owner).toEqual({ ...payload, id: expect.any(Number), pets: [] });
});

test('OWN-C-02 Created owner is retrievable and identical', async ({ client }) => {
    const created = await createOwner(client, OwnerFactory.random());
    expect(await client.owners.get(created.id)).toEqual(created);
});

test('OWN-C-03 Created owner appears in list', async ({ client }) => {
    const owner = await createOwner(client, OwnerFactory.random());
    const owners = await client.owners.getAll(owner.lastName);
    expect(owners).toContainEqual(owner);
});

test('OWN-C-04 Server assigns id; client-supplied id and pets are ignored', async ({ client }) => {
    const payload = {
        ...OwnerFactory.random(),
        id: 99999,
        pets: [{ name: 'Ghost', birthDate: '2020-01-01', type: { id: 1, name: 'cat' } }],
    };
    const response = await createOwnerRaw(client, payload);
    expect(response.status()).toBe(201);
    const owner = await response.json();
    expect(owner.id).not.toBe(99999);
    expect(owner.pets).toEqual([]);
});

test('OWN-C-05 Two creates of identical payload yield distinct ids', async ({ client }) => {
    const payload = OwnerFactory.random();
    const first = await createOwner(client, payload);
    const second = await createOwner(client, payload);
    expect(first.id).not.toBe(second.id);
});

test('OWN-C-06 Create owner fails for empty object', async ({ client }) => {
    const response = await client.owners.createRaw({});
    await expectValidationError(response, ...REQUIRED_FIELDS);
});

for (const field of REQUIRED_FIELDS) {
    test(`OWN-C-07 Create owner fails when ${field} is missing`, async ({ client }) => {
        const payload: Partial<CreateOwner> = OwnerFactory.random();
        delete payload[field];
        await expectValidationError(await createOwnerRaw(client, payload), field);
    });

    test(`OWN-C-09 Create owner fails when ${field} is empty`, async ({ client }) => {
        const payload = { ...OwnerFactory.random(), [field]: '' };
        await expectValidationError(await createOwnerRaw(client, payload), field);
    });
}

for (const field of REQUIRED_FIELDS) {
    test(`OWN-C-08 Create owner fails when ${field} is null`, async ({ client }) => {
        const payload = { ...OwnerFactory.random(), [field]: null };
        await expectValidationError(await createOwnerRaw(client, payload), field);
    });
}

// ---------- Get ----------

test('OWN-G-01 Get existing owner matches schema', async ({ client }) => {
    const created = await createOwner(client, OwnerFactory.random());
    const owner = await client.owners.get(created.id);
    expect(owner).toEqual({
        id: expect.any(Number),
        firstName: expect.any(String),
        lastName: expect.any(String),
        address: expect.any(String),
        city: expect.any(String),
        telephone: expect.any(String),
        pets: expect.any(Array),
    });
    expect(Number.isInteger(owner.id)).toBe(true);
    expect(owner.id).toBe(created.id);
});

test('OWN-G-03 Get non-existent owner returns 404', async ({ client }) => {
    const response = await client.owners.getRaw(NON_EXISTING_ID);
    expect(response.status()).toBe(404);
});

test('OWN-G-04 Get owner with id 0 returns 404', async ({ client }) => {
    expect((await client.owners.getRaw(0)).status()).toBe(404);
});

// KNOWN DEFECT D4 (design Q3a): invalid path id returns 500 instead of documented 400.
for (const id of ['-1', 'abc', '2147483648', '1.5']) {
    test(`OWN-G-05 Get owner with invalid id "${id}" returns 400`, async ({ client }) => {
        const response = await client.owners.getRaw(id);
        // Expected failure only while the documented defect (500) is observed; other statuses fail normally.
        test.fail(
            response.status() === 500,
            'Known defect D4/Q3a: API returns 500 for invalid path id, spec says 400',
        );
        expect(response.status()).toBe(400);
    });
}

// KNOWN DEFECT D9 (design Q6): 404 body is empty instead of ProblemDetail.
test('OWN-G-08 Get non-existent owner returns ProblemDetail body', async ({ client }) => {
    const response = await client.owners.getRaw(NON_EXISTING_ID);
    expect(response.status()).toBe(404);
    // Expected failure only while the documented defect (empty 404 body) is observed.
    const text = await response.text();
    test.fail(text === '', 'Known defect D9/Q6: 404 for missing owner has an empty body');
    expect(JSON.parse(text)).toMatchObject({ status: 404 });
});

// ---------- List ----------

test('OWN-L-01 List all owners matches schema', async ({ client }) => {
    const owners = await client.owners.getAll();
    expect(owners.length).toBeGreaterThan(0);
    for (const owner of owners) {
        expect(owner).toEqual({
            id: expect.any(Number),
            firstName: expect.any(String),
            lastName: expect.any(String),
            address: expect.any(String),
            city: expect.any(String),
            telephone: expect.any(String),
            pets: expect.any(Array),
        });
    }
});

test('OWN-L-02 Filter by existing lastName', async ({ client }) => {
    const owner = await createOwner(client, OwnerFactory.random());
    const owners = await client.owners.getAll(owner.lastName);
    expect(owners.map((o) => o.id)).toContain(owner.id);
    for (const o of owners) {
        expect(o.lastName.startsWith(owner.lastName)).toBe(true);
    }
});

// KNOWN DEFECT D7 (design Q4): v1 list with no match returns 404 instead of 200 [].
test('OWN-L-03 List owners with no matching lastName returns empty list', async ({ client }) => {
    const response = await client.owners.getAllRaw(OwnerFactory.random().lastName);
    // Expected failure only while the documented defect (404 on no match) is observed.
    test.fail(
        response.status() === 404,
        'Known defect D7/Q4: GET /owners with no match returns 404, spec says 200',
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);
});

// ---------- Update ----------

test('OWN-U-01 Update all fields of existing owner', async ({ client }) => {
    const owner = await createOwner(client, OwnerFactory.random());
    const response = await client.owners.updateRaw(owner.id, OwnerFactory.random());
    expect(response.status()).toBe(204);
    expect(await response.text()).toBe('');
});

test('OWN-U-02 Update is persisted', async ({ client }) => {
    const owner = await createOwner(client, OwnerFactory.random());
    const newData = OwnerFactory.random();
    await client.owners.update(owner.id, newData);
    expect(await client.owners.get(owner.id)).toEqual({
        ...newData,
        id: owner.id,
        pets: owner.pets,
    });
});

test('OWN-U-04 Update non-existent owner returns 404', async ({ client }) => {
    const response = await client.owners.updateRaw(NON_EXISTING_ID, OwnerFactory.random());
    expect(response.status()).toBe(404);
});

// ---------- Delete ----------

test('OWN-D-01 Delete existing owner', async ({ client }) => {
    const owner = await createOwner(client, OwnerFactory.random());
    const response = await client.owners.deleteRaw(owner.id);
    expect(response.status()).toBe(204);
    expect(await response.text()).toBe('');
});

test('OWN-D-02 Deleted owner is gone', async ({ client }) => {
    const owner = await createOwner(client, OwnerFactory.random());
    await client.owners.delete(owner.id);

    expect((await client.owners.getRaw(owner.id)).status()).toBe(404);

    const response = await client.owners.getPageRaw({ lastName: owner.lastName });
    expect(response.status()).toBe(200);
    expect((await response.json()).content).toEqual([]);
});

test('OWN-D-03 Delete non-existent and already deleted owner returns 404', async ({ client }) => {
    expect((await client.owners.deleteRaw(NON_EXISTING_ID)).status()).toBe(404);

    const owner = await createOwner(client, OwnerFactory.random());
    await client.owners.delete(owner.id);
    expect((await client.owners.deleteRaw(owner.id)).status()).toBe(404);
});
