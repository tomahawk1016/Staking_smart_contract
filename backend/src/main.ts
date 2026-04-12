import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origin = process.env.FRONTEND_ORIGIN?.trim() || "http://localhost:5173";
  app.enableCors({
    origin: origin === "*" ? true : origin.split(",").map((o) => o.trim()),
    credentials: true,
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`API http://localhost:${port}/api`);
}

bootstrap();
