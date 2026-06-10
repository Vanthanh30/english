import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class MongoIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[a-f\d]{24}$/i.test(value)) {
      throw new BadRequestException('A valid MongoDB ObjectId is required');
    }
    return value;
  }
}
