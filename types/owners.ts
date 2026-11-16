export interface CreateOwner {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    telephone: string;
}

export interface Owner extends CreateOwner {
    id: number;
    pets: unknown[];
}
