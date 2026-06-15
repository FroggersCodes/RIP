export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AppError';
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message = 'Insufficient balance') {
    super(402, message);
    this.name = 'InsufficientFundsError';
  }
}
