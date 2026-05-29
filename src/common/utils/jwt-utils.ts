import jwt, { JwtPayload } from 'jsonwebtoken';
import { LoggedInUserTokenData } from '../interfaces/loggedin-user-token-data';

export class TokenUtils {
  static createAccessToken(
    payload: LoggedInUserTokenData,
    secret: string,
    duration: number,
  ): string {
    return jwt.sign(payload, secret, {
      expiresIn: duration,
    });
  }

  static verifyAccessToken(
    token: string,
    secret: string,
  ): LoggedInUserTokenData {
    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;
      return {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      throw error;
    }
  }

  static createRefreshToken(
    payload: LoggedInUserTokenData,
    secret: string,
    duration: number,
  ): string {
    return jwt.sign(payload, secret, {
      expiresIn: duration,
    });
  }

  static verifyRefreshToken(
    token: string,
    secret: string,
  ): LoggedInUserTokenData | null {
    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;
      return {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
    } catch {
      return null;
    }
  }

  //   static createActivationToken(userId: string): string {
  //     return jwt.sign({ userId }, getGeneralConfig().activationTokenSecret);
  //   }

  //   static verifyActivationToken(token: string): string | null {
  //     try {
  //       const decoded = jwt.verify(
  //         token,
  //         getGeneralConfig().activationTokenSecret
  //       ) as JwtPayload | string;
  //       if (typeof decoded === "string") {
  //         return null;
  //       }
  //       return typeof decoded.userId === "string" ? decoded.userId : null;
  //     } catch {
  //       return null;
  //     }
  //   }

  //   static createForgotPasswordToken(userId: string): string {
  //     return jwt.sign({ userId }, getGeneralConfig().forgotPasswordTokenSecret);
  //   }

  //   static verifyForgotPasswordToken(token: string): string | null {
  //     try {
  //       const decoded = jwt.verify(
  //         token,
  //         getGeneralConfig().forgotPasswordTokenSecret
  //       ) as JwtPayload | string;
  //       if (typeof decoded === "string") {
  //         return null;
  //       }
  //       return typeof decoded.userId === "string" ? decoded.userId : null;
  //     } catch {
  //       return null;
  //     }
  //   }
}
