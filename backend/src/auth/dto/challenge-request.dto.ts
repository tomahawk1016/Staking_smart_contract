import { IsEthereumAddress, IsInt, IsOptional, Min } from "class-validator";

export class ChallengeRequestDto {
  @IsEthereumAddress()
  walletAddress!: `0x${string}`;

  @IsOptional()
  @IsInt()
  @Min(1)
  chainId?: number;
}
