import { Injector, type Provider } from "injectus";
import { AdminService } from "./modules/admin/admin.service.ts";
import { AnalyticsService } from "./modules/analytics/analytics.service.ts";
import { AttendanceService } from "./modules/attendance/attendance.service.ts";
import { QrCrypto } from "./modules/attendance/qr.crypto.ts";
import { QRTokenService } from "./modules/attendance/qr.service.ts";
import { AuthService } from "./modules/auth/auth.service.ts";
import { JwtService } from "./modules/auth/jwt.service.ts";
import { CoursesService } from "./modules/courses/courses.service.ts";
import { CacheProvider } from "./shared/cache/cache.provider.ts";
import { ConfigProvider } from "./shared/config/config.ts";
import { Database } from "./shared/database/database.ts";
import { LoggerProvider } from "./shared/logger/logger.ts";

export function createAppInjector(overrides: Provider[] = []): Injector {
  return Injector.create({
    name: "root",
    providers: [
      ConfigProvider,
      LoggerProvider,
      CacheProvider,
      Database,
      CoursesService,
      AdminService,
      AttendanceService,
      AnalyticsService,
      AuthService,
      JwtService,
      QrCrypto,
      QRTokenService,
      ...overrides,
    ],
  });
}
