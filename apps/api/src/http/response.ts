import type { Response } from 'express';

// User-facing messages (Indonesian); JSON shape follows ApiResponse<T>.
export const ERROR_MESSAGES = {
  unauthenticated: 'Autentikasi diperlukan',
  forbidden: 'Akses ditolak',
  invalidCredentials: 'Email atau password salah',
  invalidBody: 'Body request tidak valid',
  invalidQuery: 'Parameter query tidak valid',
  payloadTooLarge: 'Payload terlalu besar',
  notFound: 'Rute tidak ditemukan',
  resourceNotFound: 'Data tidak ditemukan',
  conflict: 'Perubahan status ditolak karena konflik',
  internal: 'Terjadi kesalahan internal',
} as const;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = { success: true, data };
  res.status(status).json(body);
}

export function sendError(res: Response, status: number, error: string): void {
  const body: ApiResponse<never> = { success: false, error };
  res.status(status).json(body);
}

export function sendUnauthorized(
  res: Response,
  error: string = ERROR_MESSAGES.unauthenticated,
): void {
  res.setHeader('WWW-Authenticate', 'Bearer');
  sendError(res, 401, error);
}
