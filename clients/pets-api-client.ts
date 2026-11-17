import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { CreatePet, Pet } from '../types/pets';

/**
 * Pets client. `*Raw` methods return the untouched `APIResponse` (for negative tests);
 * unsuffixed methods are happy-path: they assert the expected status and return typed data.
 * Happy-path `update`/`delete` expect 204 (confirmed intended), although the OpenAPI spec documents 200 for `/pets/{id}`.
 * Pets are created only via the owner-scoped path.
 */
export class PetsAPIClient {
    private readonly petsPath = '/petclinic/api/pets';
    private readonly ownersPath = '/petclinic/api/owners';

    constructor(private readonly request: APIRequestContext) {}

    // ---- raw ----

    createRaw(ownerId: number | string, payload: unknown): Promise<APIResponse> {
        return this.request.post(`${this.ownersPath}/${ownerId}/pets`, { data: payload });
    }

    getAllRaw(): Promise<APIResponse> {
        return this.request.get(this.petsPath);
    }

    getPageRaw(
        params: { page?: number | string; size?: number | string } = {},
    ): Promise<APIResponse> {
        return this.request.get('/petclinic/api/v2/pets', { params });
    }

    getRaw(id: number | string): Promise<APIResponse> {
        return this.request.get(`${this.petsPath}/${id}`);
    }

    updateRaw(id: number | string, payload: unknown): Promise<APIResponse> {
        return this.request.put(`${this.petsPath}/${id}`, { data: payload });
    }

    deleteRaw(id: number | string): Promise<APIResponse> {
        return this.request.delete(`${this.petsPath}/${id}`);
    }

    getOwnersPetRaw(ownerId: number | string, petId: number | string): Promise<APIResponse> {
        return this.request.get(`${this.ownersPath}/${ownerId}/pets/${petId}`);
    }

    updateOwnersPetRaw(
        ownerId: number | string,
        petId: number | string,
        payload: unknown,
    ): Promise<APIResponse> {
        return this.request.put(`${this.ownersPath}/${ownerId}/pets/${petId}`, { data: payload });
    }

    // ---- happy path ----

    async create(ownerId: number, payload: CreatePet): Promise<Pet> {
        const response = await this.createRaw(ownerId, payload);
        await this.expectStatus(response, 201, `POST Pet for Owner ${ownerId}`);
        return (await response.json()) as Pet;
    }

    async getAll(): Promise<Pet[]> {
        const response = await this.getAllRaw();
        await this.expectStatus(response, 200, 'GET all Pets');
        return (await response.json()) as Pet[];
    }

    async get(id: number): Promise<Pet> {
        const response = await this.getRaw(id);
        await this.expectStatus(response, 200, `GET Pet ${id}`);
        return (await response.json()) as Pet;
    }

    async update(id: number, payload: CreatePet): Promise<void> {
        const response = await this.updateRaw(id, payload);
        await this.expectStatus(response, 204, `PUT Pet ${id}`);
    }

    async delete(id: number): Promise<void> {
        const response = await this.deleteRaw(id);
        await this.expectStatus(response, 204, `DELETE Pet ${id}`);
    }

    async getOwnersPet(ownerId: number, petId: number): Promise<Pet> {
        const response = await this.getOwnersPetRaw(ownerId, petId);
        await this.expectStatus(response, 200, `GET Pet ${petId} of Owner ${ownerId}`);
        return (await response.json()) as Pet;
    }

    async updateOwnersPet(ownerId: number, petId: number, payload: CreatePet): Promise<void> {
        const response = await this.updateOwnersPetRaw(ownerId, petId, payload);
        await this.expectStatus(response, 204, `PUT Pet ${petId} of Owner ${ownerId}`);
    }

    private async expectStatus(response: APIResponse, expected: number, operation: string) {
        expect(
            response.status(),
            `${operation}: expected ${expected}, got ${response.status()} ${response.statusText()}. Body: ${await response.text()}`,
        ).toBe(expected);
    }
}
