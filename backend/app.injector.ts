import { Injector, type Provider } from "injectus";
import { AdminService } from "./modules/admin/admin.service.ts";
import { AttendanceService } from "./modules/attendance/attendance.service.ts";
import { CoursesService } from "./modules/courses/courses.service.ts";
import { QRTokenService } from "./services/qrTokenService.ts";
import { CacheProvider } from "./shared/cache/cache.provider.ts";
import { ConfigProvider } from "./shared/config/config.ts";
import { Database } from "./shared/database/database.ts";

export function createAppInjector(overrides: Provider[] = []): Injector {
  return Injector.create({
    name: "root",
    providers: [
      ConfigProvider,
      CacheProvider,
      Database,
      CoursesService,
      AdminService,
      AttendanceService,
      QRTokenService,
      ...overrides,
    ],
  });
}
