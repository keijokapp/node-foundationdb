export default class FDBError extends Error {
  code: number

  constructor(description: string, code: number) {
    super(description)

    Object.setPrototypeOf(this, FDBError.prototype)

    this.code = code
  }
}
