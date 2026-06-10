import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

@Catch()
export class ErrorMiddleware implements ExceptionFilter {
  catch(_exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    response.status(500).json({ message: 'Internal server error' });
  }
}
