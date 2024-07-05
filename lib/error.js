// @ts-check

export default class FDBError extends Error {
  /**
   * @param {string} description
   * @param {number} code
   */
  constructor(description, code) {
    super(description)

    Object.setPrototypeOf(this, FDBError.prototype);
    // Error.captureStackTrace(this, this.constructor);

    /** @type {number} */
    this.code = code
  }
}
