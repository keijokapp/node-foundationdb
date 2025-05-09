export default class FDBError extends Error {
  /**
   * @param {string} description
   * @param {number} code
   */
  constructor(description, code) {
    super(description)

    /** @type {number} */
    this.code = code
  }
}
