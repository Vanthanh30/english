export const jwtConfig = {
  accessSecretKey: 'JWT_ACCESS_SECRET',
  refreshSecretKey: 'JWT_REFRESH_SECRET',
  accessExpirationKey: 'JWT_ACCESS_EXPIRES_IN',
  refreshExpirationKey: 'JWT_REFRESH_EXPIRES_IN',
} as const;
