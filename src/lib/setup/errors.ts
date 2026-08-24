export class SetupInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupInputError";
  }
}