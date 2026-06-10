process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.DATABASE_URL = 'mongodb://localhost:27017/english_quest_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET =
  'test-access-secret-with-at-least-32-characters';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-with-at-least-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
