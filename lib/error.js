// @ts-check

export default class FDBError extends Error {
  /**
   * @param {string} description
   * @param {number} code
   */
  constructor(description, code) {
    super(description)

    Object.setPrototypeOf(this, FDBError.prototype);

    /** @type {number} */
    this.code = code
  }
}
