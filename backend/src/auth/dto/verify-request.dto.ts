import { IsString, MinLength } from "class-validator";

export class VerifyRequestDto {
  @IsString()
  @MinLength(10)
  message!: string;

  @IsString()
  @MinLength(130)
  signature!: `0x${string}`;
}
