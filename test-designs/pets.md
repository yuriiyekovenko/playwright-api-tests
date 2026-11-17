# Test Design: Pets API

Status: DRAFT v1, awaiting human review. No tests have been implemented. Each scenario is marked **READY** (expected behavior is established by the OpenAPI spec or by a recorded precedent) or **NEEDS CLARIFICATION** (spec silent, spec contradicts itself or the service, or a human decision is needed).

Sources and labels

- **[DOC]** OpenAPI from `http://localhost:9966/petclinic/v3/api-docs` (service was already running; spec needs basic auth).
- **[OBS]** Live probing on 2026-11-16 with admin credentials from `.env`. Only data created by this investigation was touched (2 probe owners and about 12 probe pets, all deleted afterwards; final state 10 owners and 13 pets, i.e. the seed). Seeded data was only read.
- **[PREC]** Precedent from `test-designs/owners.md` (same service, same defects).
- **[ASSUMPTION]** Needs verification.
- Observed behavior is never accepted as correct on its own; where it contradicts [DOC] the scenario is written to the documented expectation and flagged as a suspected defect (SD-n, Section 8).

## 1. Resource overview

A Pet has `name` (string, max 30, min 0), `birthDate` (date), `type` (PetType `{id, name}`, both required) and read-only `id`, `ownerId`, `visits[]`. Pets cannot exist without an owner. Creation is only possible via `POST /owners/{ownerId}/pets`; there is no `POST /pets`. Pet operations exist on two path trees: `/pets/...` (by pet id) and `/owners/{ownerId}/pets/...` (owner-scoped).

Schemas [DOC]

| Schema    | Required                                       | Notes                                                                                                       |
| --------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| PetFields | birthDate, name, type                          | Request body of `POST /owners/{o}/pets` and `PUT /owners/{o}/pets/{p}`                                      |
| Pet       | birthDate, id, name, type, visits              | Response body; ALSO the request body of `PUT /pets/{petId}` (see AMB-4). `id`, `ownerId`, `visits` readOnly |
| PetType   | id, name                                       | name 1..80                                                                                                  |
| PetPage   | content, page, size, totalElements, totalPages | Response of `GET /v2/pets`                                                                                  |

Errors use `ProblemDetail` (`type, title, status, detail, timestamp, schemaValidationErrors[]`) [DOC]. All path ids are int32, minimum 0 [DOC]. The spec defines no security schemes; the service uses HTTP basic auth (CLAUDE.md, [PREC] Q5a).

## 2. Endpoint inventory

| Method | Path                               | operationId     | Documented statuses         | Observed happy status |
| ------ | ---------------------------------- | --------------- | --------------------------- | --------------------- |
| GET    | /api/pets                          | listPets        | 200, 304, 500               | 200 (array)           |
| GET    | /api/v2/pets                       | listPetsPage    | 200, 400, 500               | 200 (PetPage)         |
| GET    | /api/pets/{petId}                  | getPet          | 200, 304, 400, 404, 500     | 200                   |
| PUT    | /api/pets/{petId}                  | updatePet       | **200**, 304, 400, 404, 500 | **204**, empty body   |
| DELETE | /api/pets/{petId}                  | deletePet       | **200**, 304, 400, 404, 500 | **204**, empty body   |
| POST   | /api/owners/{ownerId}/pets         | addPetToOwner   | 201, 400, 404, 500          | 201 (Pet)             |
| GET    | /api/owners/{ownerId}/pets/{petId} | getOwnersPet    | 200, 304, 400, 404, 500     | 200                   |
| PUT    | /api/owners/{ownerId}/pets/{petId} | updateOwnersPet | 204, 400, 404, 500          | 204                   |

Out of scope: `POST /owners/{o}/pets/{p}/visits` (Visits resource). It is used only as setup in PET-U-09 and PET-D-05.

## 3. Framework and data-setup needs

Existing framework: `client` fixture -> `PetClinicAPIClient` with `petTypes` and `owners` sub-clients (`*Raw` + happy-path convention, `expectStatus` helper); `OwnerFactory.random()`; `types/owners.ts` currently types `pets` as `unknown[]`. There is no pets client, pet types or pet factory. Proposed (not implemented here):

- `types/pets.ts`: `CreatePet` (`name, birthDate, type`), `Pet` (adds `id, ownerId, visits`), `PetPage`.
- `factories/pet-factory.ts`: `PetFactory.random(type)` with a short random name (<=30 chars), a past `birthDate` (not within the last day, and not older than 50 years, see AMB-2), and a valid `type {id, name}`. The type must be sent with BOTH `id` and `name` (spec requires both and the service rejects a type without `name`).
- `clients/pets-api-client.ts` (`client.pets`): `*Raw` and happy-path methods for the 8 operations above; happy-path `update`/`delete` expect 204 (pending AMB-1).
- Pet type data: use seeded types read-only (`GET /pettypes`; ids 1..6 are cat, dog, lizard, snake, bird, hamster). A pet should not require creating a pet type; where a test needs a type not used by the pet, pick another seeded type.
- Per-test data: every test creates its own owner via `client.owners.create(OwnerFactory.random())` and its own pet(s) via `POST /owners/{id}/pets`. Tests run fully parallel, so no shared state. Never use or modify seeded pets or owners (ids 1..10 owners, 1..13 pets); seeded pet id 1 is read-only in PET-G-02.
- Clean-up order matters. **[OBS]** `DELETE /owners/{id}` for an owner that still has pets returns **404 `DataIntegrityViolationException`** and the owner is NOT deleted (it succeeded only after the pets were deleted). So teardown must delete the test's pets first (`DELETE /pets/{id}`), then the owner. This also contradicts `owners.md` OWN-D-04 (cascade delete), see AMB-9; the existing `owners-api.spec.ts` `afterEach` (owner delete only) would leak owners that have pets.
- Non-existent id: `2147483647` (404 [OBS]).

## 4. Relationship to owners.md (de-duplication)

`owners.md` section 6.7 sketched OWN-PET-01..09. None of them is implemented (`grep OWN-PET tests/` is empty), and that file defers full coverage to a Pets design. To avoid duplicate tests, **this document owns all pet scenarios** and the OWN-PET scenarios should be implemented under the PET IDs below only:

| owners.md  | Superseded by                      |
| ---------- | ---------------------------------- |
| OWN-PET-01 | PET-C-01                           |
| OWN-PET-02 | PET-C-13                           |
| OWN-PET-03 | PET-C-04..C-12, PET-C-14, PET-C-15 |
| OWN-PET-04 | PET-C-16                           |
| OWN-PET-05 | PET-O-01                           |
| OWN-PET-06 | PET-O-02                           |
| OWN-PET-07 | PET-O-03                           |
| OWN-PET-08 | PET-O-04                           |
| OWN-PET-09 | PET-O-06                           |

Owner-centric checks stay in owners.md (OWN-G-07 owner GET reflects its pets, OWN-D-04 owner delete cascade). Visits scenarios (OWN-VIS-*) belong to a Visits design.

## 5. Test scenarios

Priority: P0 = core CRUD and contract, P1 = validation, error handling, consistency, P2 = lenient or observed-only behavior. Status: R = READY, NC = NEEDS CLARIFICATION. "SD-n"/"AMB-n" refer to Section 8.

### 5.1 Create pet (POST /api/owners/{ownerId}/pets)

| ID       | Pri | St  | Scenario                                                                     | Data / precondition                                                                            | Expected                                                                                                                                                                                         |
| -------- | --- | --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PET-C-01 | P0  | R   | Create pet with valid data; verify response and read-after-write             | new owner; `PetFactory.random()` with seeded type                                              | 201 [DOC]; JSON body: `name`, `birthDate` equal input, `type` equals `{id, name}` of the seeded type, numeric `id`, `ownerId` = owner id, `visits: []`. `GET /pets/{id}` returns the same object |
| PET-C-02 | P1  | R   | Server-assigned `id`, `ownerId`, `visits` ignored in payload                 | payload adds `id: 99999`, `ownerId: <other owner>`, `visits:[{description:'x'}]`               | 201; `id` != 99999; `ownerId` = path owner; `visits: []` [OBS]. Ids are readOnly [DOC]                                                                                                           |
| PET-C-03 | P1  | NC  | `type.name` in payload is ignored, type resolved by `type.id`                | `type: {id: 1, name: 'bogus'}`                                                                 | [OBS] 201 and response `type.name` = `cat`. Spec silent, see AMB-5                                                                                                                               |
| PET-C-04 | P1  | R   | `name` boundary: 30 chars accepted                                           | name of exactly 30 chars                                                                       | 201; stored name equals input [DOC maxLength 30]                                                                                                                                                 |
| PET-C-05 | P1  | R   | `name` boundary: 31 chars rejected                                           | name of 31 chars                                                                               | 400 ProblemDetail, `schemaValidationErrors[].field` = `name` [DOC, OBS]                                                                                                                          |
| PET-C-06 | P1  | R   | Required fields missing, one per case (`name`, `birthDate`, `type`) and `{}` | payload without the field                                                                      | 400 ProblemDetail with `detail` "The request contains invalid or missing parameters" and the field named in `schemaValidationErrors` [DOC required, OBS]                                         |
| PET-C-07 | P1  | NC  | `name` empty string `""`                                                     | `name: ""`                                                                                     | Spec allows (`minLength 0`). [OBS] **500 `ConstraintViolationException`**. Expected is either 201 or 400 but never 500; decision needed (AMB-3, SD-4)                                            |
| PET-C-08 | P2  | NC  | `name` whitespace only `"  "`                                                | `name: "  "`                                                                                   | [OBS] 201, stored as given. Inconsistent with the `""` result; AMB-3                                                                                                                             |
| PET-C-09 | P2  | R   | `name` with unicode / punctuation accepted                                   | `Ünï`, `Rex-2 'Jr'`                                                                            | 201; stored unchanged (spec defines no pattern for pet name)                                                                                                                                     |
| PET-C-10 | P1  | NC  | `birthDate` in the future rejected                                           | tomorrow, `2999-01-01`                                                                         | [OBS] 400 with message "Birth date cannot be in the future". Rule is not in the spec (AMB-2)                                                                                                     |
| PET-C-11 | P2  | NC  | `birthDate` today accepted (boundary of the future rule)                     | today (UTC and local date can differ; use a date at least one day in the past for other tests) | [OBS] 201. AMB-2                                                                                                                                                                                 |
| PET-C-12 | P2  | NC  | `birthDate` older than 50 years rejected, exactly 50 years accepted          | today-50y -> 201; today-50y-1d probe unverified; `1800-01-01` -> 400                           | [OBS] 400 "cannot be older than 50 years" for 1800-01-01; 50y boundary accepted. Rule undocumented (AMB-2)                                                                                       |
| PET-C-13 | P1  | R   | `birthDate` malformed                                                        | `2020-13-45`, `not-a-date`, `01/01/2020`, `""`                                                 | 400 expected [DOC 400 "Bad request"]. [OBS] `2020-13-45` returns **500 `HttpMessageNotReadableException`** (SD-2); other variants unverified                                                     |
| PET-C-14 | P1  | R   | `type` null or missing                                                       | `type: null`; no `type`                                                                        | 400 [DOC required, OBS] (the missing-field case is also in PET-C-06; this row adds explicit `null`)                                                                                              |
| PET-C-15 | P1  | R   | `type` incomplete: only `{id}`, only `{name}`                                | `type:{id:1}`, `type:{name:'cat'}`                                                             | 400, field `type.name` / `type.id` [DOC PetType requires both; OBS]                                                                                                                              |
| PET-C-16 | P1  | NC  | `type.id` does not exist                                                     | `type: {id: 99999, name: 'zzz'}`                                                               | Spec lists 400 and 404 for this operation; [OBS] 404 `DataIntegrityViolationException` "data constraint violation" (PREC Q7a, undecided)                                                         |
| PET-C-17 | P1  | R   | Owner does not exist                                                         | `ownerId = 2147483647`, valid body                                                             | 404 [DOC, OBS]; [OBS] empty body although spec says ProblemDetail (SD-5; body asserted only in PET-G-04)                                                                                         |
| PET-C-18 | P1  | R   | Invalid owner id                                                             | `abc`, `-1` (minimum 0)                                                                        | 400 expected [DOC]; [OBS] 500 `MethodArgumentTypeMismatchException` for `abc` (SD-1); `-1` unverified on this path                                                                               |
| PET-C-19 | P1  | R   | Malformed JSON / empty body (also reused for PUT, see PET-U-10)              | `{bad`, empty body                                                                             | 400 expected [DOC]; [OBS] 500 `HttpMessageNotReadableException` (SD-2)                                                                                                                           |
| PET-C-20 | P2  | NC  | Unsupported `Content-Type` (`text/plain`)                                    | body `x`                                                                                       | [OBS] 500 `HttpMediaTypeNotSupportedException`; expected 4xx (415?) undocumented (PREC Q3c)                                                                                                      |
| PET-C-21 | P2  | NC  | Wrong JSON types: `name: 123`, `birthDate: 20200101`, `type: "cat"`          |                                                                                                | [OBS] `name: 123` is coerced and stored as `"123"` (201). Others unverified. AMB-3                                                                                                               |
| PET-C-22 | P2  | NC  | Same name / birthDate / type created twice for one owner                     | duplicate payload twice                                                                        | Spec defines no uniqueness; [OBS] duplicates accepted (`X` created twice, distinct ids). Document, do not enforce                                                                                |

### 5.2 Get pet by id (GET /api/pets/{petId})

| ID       | Pri | St  | Scenario                        | Data / precondition                  | Expected                                                                                                                                                          |
| -------- | --- | --- | ------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PET-G-01 | P0  | R   | Get existing pet                | pet created in PET-C-01 setup        | 200; matches Pet schema (typed fields, `visits` array, `ownerId` = owner); equals the create response                                                             |
| PET-G-02 | P1  | R   | Seeded pet contract (read-only) | pet id 1                             | 200; `name` `Leo`, `type {id:1,name:'cat'}`, `ownerId` 1, `visits` array [OBS]. Seed-dependent: assert stable fields only (PREC Q10)                              |
| PET-G-03 | P1  | R   | Non-existent pet                | `2147483647`, `0`                    | 404 [DOC, OBS for 2147483647; `0` valid per minimum, expected 404, unverified]                                                                                    |
| PET-G-04 | P1  | NC  | 404 body is ProblemDetail       | `2147483647`                         | [DOC] 404 content is `ProblemDetail`; [OBS] empty body (SD-5, PREC Q6). Written to the doc, expected red                                                          |
| PET-G-05 | P1  | R   | Invalid pet id                  | `abc`, `-1`, `2147483648` (overflow) | 400 expected [DOC 400, minimum 0]; [OBS] 500 `MethodArgumentTypeMismatchException` (`abc`), 500 `ConstraintViolationException` (`-1`) (SD-1); overflow unverified |

304 Not Modified is documented on GET/PUT/DELETE but is not reachable without conditional headers [PREC Q9]; no scenario (N/A).

### 5.3 List pets (GET /api/pets, GET /api/v2/pets)

| ID       | Pri | St  | Scenario                                                              | Data / precondition                         | Expected                                                                                                                                                                              |
| -------- | --- | --- | --------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PET-L-01 | P0  | R   | v1 list contains a newly created pet and every item has the Pet shape | created pet                                 | 200 array; contains the pet (match by `id`) with equal fields; each item has `id, name, birthDate, type, ownerId, visits`. Do not assert total count (parallel tests, shared service) |
| PET-L-02 | P1  | R   | v2 default page shape                                                 | no params                                   | 200; PetPage with `content[]`, `page` 0, `size` 20 (documented default), `totalElements`, `totalPages`; `content.length <= 20` [DOC]                                                  |
| PET-L-03 | P1  | R   | v2 `page`/`size` honored                                              | `size=2&page=0` and `page=1`                | 200; `content.length` 2; `page`/`size` echoed; the two pages share no ids; `totalPages = ceil(totalElements/size)`. Requires >= 3 pets: seed has 13 (seed-dependent, read-only)       |
| PET-L-04 | P1  | R   | v2 boundary sizes                                                     | `size=1`, `size=100`                        | 200; `size` echoed; 1 item for `size=1` [DOC minimum 1, maximum 100]                                                                                                                  |
| PET-L-05 | P1  | R   | v2 invalid paging params                                              | `size=0`, `size=101`, `page=-1`, `size=abc` | 400 expected [DOC 400]; [OBS] **500** `ConstraintViolationException` / `MethodArgumentTypeMismatchException` (SD-1)                                                                   |
| PET-L-06 | P2  | NC  | v2 page beyond the last page                                          | `page=999&size=5`                           | [OBS] 200 with `content: []` and real `totalElements`. Spec silent (could reasonably be 200 empty or 400)                                                                             |
| PET-L-07 | P1  | R   | v1 and v2 consistency                                                 | created pet                                 | the created pet is found in v1 and v2 (`size=100` is enough only while total <= 100; otherwise page through)                                                                          |

### 5.4 Update pet by id (PUT /api/pets/{petId})

| ID       | Pri | St  | Scenario                                                     | Data / precondition                                              | Expected                                                                                                                                                        |
| -------- | --- | --- | ------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PET-U-01 | P0  | NC  | Update all fields                                            | created pet; new name, birthDate, other seeded type              | [OBS] **204**, empty body; [DOC] says 200 with a Pet body (AMB-1). Owners precedent (Q1) treated the same doc pattern as a documentation defect and expects 204 |
| PET-U-02 | P0  | R   | Update is persisted (read-after-write)                       | after PET-U-01, `GET /pets/{id}` and `GET /owners/{o}/pets/{id}` | all three fields equal the new values; `id` and `ownerId` unchanged                                                                                             |
| PET-U-03 | P1  | NC  | Body `id` / `ownerId` do not change identity or move the pet | payload `id: 999`, `ownerId: <other owner>`                      | [OBS] 204; pet keeps its id and owner. Spec marks both readOnly but `PUT /pets` body schema is `Pet` (AMB-4)                                                    |
| PET-U-04 | P1  | R   | Required fields missing                                      | `{}`; each of name/birthDate/type removed                        | 400 with `schemaValidationErrors` naming the field [DOC required, OBS `{}`]                                                                                     |
| PET-U-05 | P1  | R   | `name` 31 chars rejected; 30 accepted                        |                                                                  | 400 / 204 [DOC]. Boundary only sampled here, full set in create                                                                                                 |
| PET-U-06 | P1  | R   | Non-existent pet                                             | `2147483647`, valid body                                         | 404 [DOC, OBS]                                                                                                                                                  |
| PET-U-07 | P1  | R   | Invalid pet id                                               | `abc`, `-1`                                                      | 400 expected [DOC]; [OBS] 500 (SD-1)                                                                                                                            |
| PET-U-08 | P1  | NC  | Unknown `type.id`                                            | `type: {id: 99999, name: 'z'}`                                   | [OBS] 404 `DataIntegrityViolationException` (same open question as PET-C-16)                                                                                    |
| PET-U-09 | P1  | R   | Update preserves visits                                      | pet with one visit (setup via `POST .../visits`), then PUT       | the GET still returns the same `visits[]`                                                                                                                       |
| PET-U-10 | P1  | R   | Malformed JSON / empty body on both PUT variants             | `{bad` to `PUT /pets/{id}` and `PUT /owners/{o}/pets/{id}`       | 400 expected; behavior is unverified on PUT (POST gives 500, SD-2). Parametrized once here, not duplicated in PET-O                                             |
| PET-U-11 | P2  | NC  | Birth date rules on update (future date)                     | `2999-01-01`                                                     | [OBS] 400 (same undocumented rule as PET-C-10); sample only                                                                                                     |

### 5.5 Delete pet (DELETE /api/pets/{petId})

| ID       | Pri | St  | Scenario                                                         | Data / precondition                     | Expected                                                                                     |
| -------- | --- | --- | ---------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| PET-D-01 | P0  | NC  | Delete existing pet                                              | created pet                             | [OBS] **204**, empty body; [DOC] says 200 with a Pet body (AMB-1)                            |
| PET-D-02 | P0  | R   | Pet is gone after delete                                         | after PET-D-01                          | `GET /pets/{id}` -> 404; `GET /owners/{o}/pets/{id}` -> 404; v1 list does not contain the id |
| PET-D-03 | P1  | R   | Delete is scoped to the owner's pets: owner stays, siblings stay | owner with 2 pets; delete one           | owner GET 200; `pets[]` contains only the sibling                                            |
| PET-D-04 | P1  | R   | Delete non-existent pet; repeated delete                         | `2147483647`; the same id deleted twice | 404 [DOC, OBS] both times (second delete is the repeat case)                                 |
| PET-D-05 | P1  | NC  | Delete pet that has visits                                       | pet with a visit                        | [OBS] 204 and the pet is gone. Cascade to visits not documented (AMB-8)                      |
| PET-D-06 | P1  | R   | Invalid pet id                                                   | `abc`, `-1`                             | 400 expected [DOC]; [OBS] 500 (SD-1)                                                         |

### 5.6 Owner-scoped get and update (GET/PUT /api/owners/{ownerId}/pets/{petId})

Create (POST) is in 5.1.

| ID       | Pri | St  | Scenario                                                       | Data / precondition                                              | Expected                                                                                                                                               |
| -------- | --- | --- | -------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PET-O-01 | P0  | R   | Get owner's pet                                                | pet created for owner                                            | 200; equals `GET /pets/{id}`                                                                                                                           |
| PET-O-02 | P1  | R   | Get via wrong owner / non-existent owner / non-existent pet    | pet of owner A via owner B; `2147483647` owner; `2147483647` pet | 404 each [DOC 'Owner or pet not found', OBS]                                                                                                           |
| PET-O-03 | P0  | R   | Update via owner path                                          | created pet; new valid fields                                    | 204, empty body [DOC]; GET shows new values (not repeated from PET-U-02: this checks the owner-scoped endpoint)                                        |
| PET-O-04 | P1  | R   | Update via wrong owner is rejected and the pet is NOT modified | owner B id with owner A's pet id                                 | 404 [DOC 'Pet not found for this owner'] and a subsequent GET shows the original name. [OBS] **204 and the pet was renamed** (SD-3, security relevant) |
| PET-O-05 | P1  | R   | Update via non-existent owner / non-existent pet               | `2147483647`                                                     | 404 [DOC, OBS]                                                                                                                                         |
| PET-O-06 | P1  | R   | Update validation: `{}`, name 31 chars                         |                                                                  | 400 [DOC, OBS `{}`]                                                                                                                                    |
| PET-O-07 | P1  | R   | Invalid ids on owner-scoped paths                              | `/owners/abc/pets/1`, `/owners/{o}/pets/abc`, `-1`               | 400 expected [DOC]; [OBS] 500 (SD-1)                                                                                                                   |

### 5.7 Cross-endpoint consistency

| ID       | Pri | St  | Scenario                                                                | Data / precondition                                                        | Expected                                                                                                                                                                                                                      |
| -------- | --- | --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PET-X-01 | P1  | R   | Pet appears in owner aggregate and stays consistent after update/delete | owner with 1 pet; read `GET /owners/{id}`; update via `/pets/{id}`; delete | `pets[]` contains the pet with equal fields (`ownerId`, `type`, `visits`); after update shows new values; after delete is empty. (Owners side of this is OWN-G-07; this checks the pet-centric transitions, not the creation) |

### 5.8 Authentication

| ID       | Pri | St  | Scenario                                                            | Data / precondition                                       | Expected                                                                                                                                                            |
| -------- | --- | --- | ------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PET-A-01 | P0  | R   | All 8 pet operations without credentials and with wrong credentials | request context without `httpCredentials`; wrong password | 401 each (parametrized once across operations) [PREC Q5a, CLAUDE.md; not in the spec, AMB-7]. Mutating calls must not change data (verify one with a follow-up GET) |
| PET-A-02 | P2  | NC  | Non-admin user gets 403                                             |                                                           | No non-admin user is known; blocked (PREC Q5b). Never guess credentials                                                                                             |

## 6. Existing coverage and gaps

| Area                          | Existing automated tests                                                                                                                                    | Proposed                                          | Gap        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------- |
| Pets (any operation)          | none (`tests/` has only `pet-types-api.spec.ts` and `owners-api.spec.ts`; Owners spec asserts only `pets: []` on a new owner and ignores `pets` in payload) | PET-C 22, G 5, L 7, U 11, D 6, O 7, X 1, A 2 = 61 | 100%       |
| Pets client / factory / types | none (`pets` typed `unknown[]` in `types/owners.ts`)                                                                                                        | Section 3                                         | all        |
| OWN-PET-01..09 from owners.md | not implemented                                                                                                                                             | mapped to PET-* (Section 4)                       | superseded |

De-duplication rules applied: field boundaries (name 30/31, birthDate rules, type shape) are exercised once on create (PET-C-04..C-16) and only sampled on update (PET-U-04/05/11, PET-O-06). Malformed body and invalid-id behavior are each defined once and reused as parameters (PET-C-19/U-10, per-resource PET-G-05/U-07/D-06/O-07/C-18 differ in path template and method). Auth is one parametrized scenario. Owner-not-found is covered once for create (PET-C-17) and once per update/get path (PET-O-02/O-05). Existing OWN-* scenarios for owner aggregate (OWN-G-07, OWN-D-04) are not repeated.

## 7. Open questions and assumptions

Assumptions (to be confirmed at review)

- 204 for PUT and DELETE `/pets/{id}`, following the Owners/PetTypes precedent (the framework already treats the spec's 200 as a doc defect).
- 401 for unauthenticated calls although the spec documents no security.
- Seeded pets ids 1..13 and types ids 1..6 exist (read-only); a local container may have drifted.
- Invalid-id, malformed-body and 404-body expectations follow [DOC] and are intentionally red until fixed.

## 8. Ambiguities and suspected defects

### Ambiguities (need a decision or clarification)

| #      | Topic                                                   | Detail                                                                                                                                                                                                                                                       | Affects                  |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| AMB-1  | Status code of `PUT /pets/{id}` and `DELETE /pets/{id}` | [DOC] 200 with Pet body and description "Pet details found and returned" (copy-paste); [OBS] 204 no body. Sibling `PUT /owners/{o}/pets/{p}` is documented 204                                                                                               | PET-U-01, PET-D-01       |
| AMB-2  | Undocumented birthDate rules                            | Service rejects future dates and dates older than 50 years (400); spec has only `format: date`. Today and exactly-50-years boundaries are accepted                                                                                                           | PET-C-10..C-12, PET-U-11 |
| AMB-3  | `name` semantics                                        | Spec `minLength 0` implies `""` valid, but service returns 500 for `""` while accepting whitespace-only; numeric JSON coerced to string. No `@NotBlank` documented                                                                                           | PET-C-07, C-08, C-21     |
| AMB-4  | Request schema mismatch on `PUT /pets/{id}`             | Body is `Pet` (requires `id` and `visits`, which are readOnly) while the owner-scoped PUT uses `PetFields`. [OBS] service accepts a payload without `id`/`visits`. Which fields are required on this PUT?                                                    | PET-U-01..U-04           |
| AMB-5  | `type` resolution                                       | `type.name` mismatching `type.id` is silently ignored (response shows the real name); is that desired or should it be 400? `type` requires both `id` and `name` per spec yet `name` carries no meaning                                                       | PET-C-03, C-15           |
| AMB-6  | Unknown `type.id` / owner not found on create           | Spec lists 400 and 404 ("Pet or Owner not found"); service gives 404 via a generic `DataIntegrityViolationException` mapping (PREC Q7a)                                                                                                                      | PET-C-16, PET-U-08       |
| AMB-7  | Security                                                | Not in the spec; 401 behavior and absence of roles inferred (PREC Q5)                                                                                                                                                                                        | PET-A-01/02              |
| AMB-8  | Delete cascade                                          | Deleting a pet with visits works (visit removed?) and an owner WITH pets cannot be deleted (404 `DataIntegrityViolationException`). Intended? Conflicts with `owners.md` OWN-D-04                                                                            | PET-D-05, test teardown  |
| AMB-9  | Owner delete with pets                                  | [OBS] `DELETE /owners/{id}` returned 404 `DataIntegrityViolationException` when the owner had pets (0 visits), and the owner remained; owners.md OWN-D-04 assumes cascade. Needs reconciling in the Owners design (out of this design's scope; flagged only) | teardown, OWN-D-04       |
| AMB-10 | 304                                                     | Documented, not reachable (PREC Q9)                                                                                                                                                                                                                          | none                     |

### Suspected API defects (spec vs actual)

| #    | Defect                                                                  | Expected [DOC]                                                                                   | Actual [OBS]                                                                                                                                                                                          | Scenarios                                 |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| SD-1 | Invalid path / query values return 500                                  | 400 "Bad request"                                                                                | 500 `MethodArgumentTypeMismatchException` (`abc`) or `ConstraintViolationException` (`-1`, `size=0`, `size=101`, `page=-1`) on `/pets/{id}`, `/owners/{o}/pets/{p}`, `/v2/pets`, create/update/delete | PET-G-05, L-05, U-07, D-06, O-07, C-18    |
| SD-2 | Malformed JSON / invalid date returns 500                               | 400                                                                                              | 500 `HttpMessageNotReadableException` for `{bad` and `birthDate: 2020-13-45`                                                                                                                          | PET-C-13, C-19, U-10                      |
| SD-3 | Pet update via the wrong owner succeeds                                 | 404 "Pet not found for this owner"                                                               | `PUT /owners/{B}/pets/{petOfA}` -> 204 and the pet was renamed; GET via B correctly gives 404. Cross-owner modification                                                                               | PET-O-04                                  |
| SD-4 | `name: ""` returns 500                                                  | spec `minLength 0` allows it (201), or 400 if rejected                                           | 500 `ConstraintViolationException`                                                                                                                                                                    | PET-C-07                                  |
| SD-5 | 404 responses have empty body                                           | `ProblemDetail` per spec                                                                         | empty body for not-found 404 (only the FK 404 has ProblemDetail)                                                                                                                                      | PET-G-04 (status-only elsewhere)          |
| SD-6 | Doc defects (not behavior)                                              | `GET /pets` 200 described as "Pet types found and returned"; PUT/DELETE descriptions copy-pasted | n/a                                                                                                                                                                                                   | informational (AMB-1)                     |
| SD-7 | Trailing slash returns 500 (`/pets/` -> `NoResourceFoundException` 500) | 404                                                                                              | 500                                                                                                                                                                                                   | not scheduled (out of spec; mention only) |

## 9. Summary of counts

Total 61 scenarios: 42 READY, 19 NEEDS CLARIFICATION. Not implemented; requesting human review before any test code is written.
