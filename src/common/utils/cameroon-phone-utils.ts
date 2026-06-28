import { EnumNetwork } from '../enums/networks';

export class CameroonPhoneUtils {
  // Complete MTN legacy and new allocations (670-679, 650-654, 680-684, 620)
  private static readonly MTN_PREFIXES = [
    '650',
    '651',
    '652',
    '653',
    '654',
    '670',
    '671',
    '672',
    '673',
    '674',
    '675',
    '676',
    '677',
    '678',
    '679',
    '680',
    '681',
    '682',
    '683',
    '684',
    '620',
  ];

  // Complete Orange legacy and new allocations (690-699, 655-659)
  private static readonly ORANGE_PREFIXES = [
    '655',
    '656',
    '657',
    '658',
    '659',
    '690',
    '691',
    '692',
    '693',
    '694',
    '695',
    '696',
    '697',
    '698',
    '699',
  ];

  /**
   * Converts:
   * +237699123456 -> 699123456
   * 237699123456  -> 699123456
   * 699123456     -> 699123456
   */
  static normalize(phoneNumber: string): string {
    let phone = phoneNumber.replace(/\s+/g, '');

    if (phone.startsWith('+237')) {
      phone = phone.slice(4);
    } else if (phone.startsWith('237')) {
      phone = phone.slice(3);
    }

    return phone;
  }

  // Expects a pre-normalized string for performance, or filters raw input safely
  static isValid(phoneNumber: string): boolean {
    const phone =
      phoneNumber.length === 9 ? phoneNumber : this.normalize(phoneNumber);
    return /^6\d{8}$/.test(phone);
  }

  static getOperator(phoneNumber: string): EnumNetwork {
    const phone = this.normalize(phoneNumber);

    if (!this.isValid(phone)) {
      return EnumNetwork.UNKNOWN;
    }

    const prefix = phone.substring(0, 3);

    if (this.MTN_PREFIXES.includes(prefix)) {
      return EnumNetwork.MTN;
    }

    if (this.ORANGE_PREFIXES.includes(prefix)) {
      return EnumNetwork.ORANGE;
    }

    return EnumNetwork.UNKNOWN;
  }
}
