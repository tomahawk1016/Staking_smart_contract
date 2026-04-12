"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const origin = process.env.FRONTEND_ORIGIN?.trim() || "http://localhost:5173";
    app.enableCors({
        origin: origin === "*" ? true : origin.split(",").map((o) => o.trim()),
        credentials: true,
    });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = Number(process.env.PORT || 3001);
    await app.listen(port);
    console.log(`API http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map