import { Injector, type Provider } from "injectus";
import { CoursesService } from "./modules/courses/courses.service.ts";
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
      ...overrides,
    ],
  });
}
