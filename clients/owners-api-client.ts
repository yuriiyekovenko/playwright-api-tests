import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { CreateOwner, Owner } from '../types/owners';

/**
 * Owners client. `*Raw` methods return the untouched `APIResponse` (for negative tests);
 * unsuffixed methods are happy-path: they assert the expected status and return typed data.
 * Happy-path `update`/`delete` expect 204 (observed and intended), although the OpenAPI spec
 * documents 200 (documentation defect, see test-designs/owners.md Q1).
 */
export class OwnersAPIClient {
    private readonly resourcePath = '/petclinic/api/owners';

    constructor(private readonly request: APIRequestContext) {}

    // ---- raw ----

    createRaw(payload: unknown): Promise<APIResponse> {
        return this.request.post(this.resourcePath, { data: payload });
    }

    getAllRaw(lastName?: string): Promise<APIResponse> {
        return this.request.get(this.resourcePath, {
            params: lastName === undefined ? undefined : { lastName },
        });
    }

    getPageRaw(
        params: { lastName?: string; page?: number; size?: number } = {},
    ): Promise<APIResponse> {
        return this.request.get('/petclinic/api/v2/owners', { params });
    }

    getRaw(id: number | string): Promise<APIResponse> {
        return this.request.get(`${this.resourcePath}/${id}`);
    }

    updateRaw(id: number | string, payload: unknown): Promise<APIResponse> {
        return this.request.put(`${this.resourcePath}/${id}`, { data: payload });
    }

    deleteRaw(id: number | string): Promise<APIResponse> {
        return this.request.delete(`${this.resourcePath}/${id}`);
    }

    // ---- happy path ----

    async create(payload: CreateOwner): Promise<Owner> {
        const response = await this.createRaw(payload);
        await this.expectStatus(response, 201, 'POST Owner');
        return (await response.json()) as Owner;
    }

    async getAll(lastName?: string): Promise<Owner[]> {
        const response = await this.getAllRaw(lastName);
        await this.expectStatus(response, 200, 'GET all Owners');
        return (await response.json()) as Owner[];
    }

    async get(id: number): Promise<Owner> {
        const response = await this.getRaw(id);
        await this.expectStatus(response, 200, `GET Owner ${id}`);
        return (await response.json()) as Owner;
    }

    async update(id: number, payload: CreateOwner): Promise<void> {
        const response = await this.updateRaw(id, payload);
        await this.expectStatus(response, 204, `PUT Owner ${id}`);
    }

    async delete(id: number): Promise<void> {
        const response = await this.deleteRaw(id);
        await this.expectStatus(response, 204, `DELETE Owner ${id}`);
    }

    private async expectStatus(response: APIResponse, expected: number, operation: string) {
        expect(
            response.status(),
            `${operation}: expected ${expected}, got ${response.status()} ${response.statusText()}. Body: ${await response.text()}`,
        ).toBe(expected);
    }
}
