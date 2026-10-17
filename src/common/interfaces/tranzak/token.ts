export interface ITranzakApiTokenResponse {
  scope: string;
  appId: string;
  token: string;
  expiresIn: number;
}

export interface ITranzakCreateTokenRequestDto {
  appId: string;
  appKey: string;
}
