export default class FDBError extends Error {
    constructor(description: string, code: number);
    code: number;
}
