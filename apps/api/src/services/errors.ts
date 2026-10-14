// Typed service errors; the HTTP error handler maps them to status codes.
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class InvalidTransitionError extends ConflictError {
  readonly entity: 'task' | 'run';
  readonly from: string;
  readonly to: string;

  constructor(entity: 'task' | 'run', from: string, to: string) {
    super(`Invalid ${entity} transition ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
    this.entity = entity;
    this.from = from;
    this.to = to;
  }
}
