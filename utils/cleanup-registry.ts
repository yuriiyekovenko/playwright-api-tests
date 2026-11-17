import type { APIResponse } from '@playwright/test';

type CleanupAction = { label: string; run: () => Promise<APIResponse> };

/**
 * Per-test stack of undo actions for resources the test itself created.
 * API clients register a delete for every successful (201) create; the `client` fixture
 * runs them at teardown. Only ids returned to this test are ever deleted, so the suite is
 * safe to run against a shared, long-lived environment.
 */
export class CleanupRegistry {
    private readonly actions: CleanupAction[] = [];

    add(label: string, run: () => Promise<APIResponse>): void {
        this.actions.push({ label, run });
    }

    /**
     * Runs all actions newest-first, so children (pets) are deleted before their parents (owners).
     * 2xx and 404 (already deleted by the test) count as success. Never stops early;
     * throws once at the end listing every failed action.
     */
    async runAll(): Promise<void> {
        const failures: string[] = [];
        for (const { label, run } of this.actions.splice(0).reverse()) {
            try {
                const response = await run();
                if (!response.ok() && response.status() !== 404) {
                    failures.push(
                        `${label}: ${response.status()} ${response.statusText()}. Body: ${await response.text()}`,
                    );
                }
            } catch (error) {
                failures.push(
                    `${label}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
        if (failures.length > 0) {
            throw new Error(
                `Cleanup failed for ${failures.length} resource(s), test data may have leaked:\n${failures.join('\n')}`,
            );
        }
    }
}
