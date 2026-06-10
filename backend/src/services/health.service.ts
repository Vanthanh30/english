import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'english-quest-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
