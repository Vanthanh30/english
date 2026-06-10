import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
    Logger.log(
      `Database configured for ${new URL(databaseUrl).host}`,
      PrismaService.name,
    );
  }

  // Fallback transaction support for standalone MongoDB instances
  override $transaction<T>(
    fn: (prisma: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: any }
  ): Promise<T>;
  override $transaction<T>(
    list: Array<Prisma.PrismaPromise<any>>,
    options?: { isolationLevel?: any }
  ): Promise<any[]>;
  override async $transaction(args: any, options?: any): Promise<any> {
    try {
      return await super.$transaction(args, options);
    } catch (error: any) {
      if (
        error.code === 'P2031' ||
        error.message?.includes('replica set') ||
        error.message?.includes('transactions')
      ) {
        Logger.warn(
          'MongoDB transactions are not supported (non-replica set). Running sequentially as fallback...',
          PrismaService.name,
        );
        if (typeof args === 'function') {
          return args(this);
        }
        if (Array.isArray(args)) {
          const results = [];
          for (const op of args) {
            results.push(await op);
          }
          return results;
        }
      }
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
