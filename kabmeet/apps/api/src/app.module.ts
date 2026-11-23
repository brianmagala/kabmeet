import { Controller, Get, Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/modules/auth';
import { UsersModule } from '@/modules/users';
import { CommunitiesModule } from '@/modules/communities';
import { SessionsModule } from '@/modules/sessions';
import { ClassesModule } from '@/modules/classes';
import { AttendanceModule } from '@/modules/attendance';
import { VideoModule } from '@/modules/video';
import { AdminModule } from '@/modules/admin';

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'kabmeet-api' };
  }
}

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CommunitiesModule,
    SessionsModule,
    ClassesModule,
    AttendanceModule,
    VideoModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
