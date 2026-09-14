/** skill_toggle.py MetadataError: invocation metadata that cannot be read or changed without guessing. */
export class MetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetadataError";
  }
}
