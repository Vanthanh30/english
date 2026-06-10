import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

@Injectable()
export class SessionGenerationService {
  readonly id = randomUUID();

  isCurrent(sessionGenerationId: string | undefined): boolean {
    return sessionGenerationId === this.id;
  }
}
