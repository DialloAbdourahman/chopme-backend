import { EnumNotificationI18nType } from 'src/common/enums/notification-internationalization-type';
import { EnumUserLanguage } from 'src/common/enums/user-language';

export interface INotificationMessage {
  title: string;
  body: string;
}

type NotificationMessages = Record<EnumUserLanguage, INotificationMessage>;

type NotificationMessagesMap = Partial<
  Record<EnumNotificationI18nType, NotificationMessages>
>;

const FALLBACK_MESSAGE: NotificationMessages = {
  [EnumUserLanguage.FR]: {
    title: 'Nouvelle notification',
    body: 'Vous avez reçu une nouvelle notification.',
  },
  [EnumUserLanguage.EN]: {
    title: 'New notification',
    body: 'You have received a new notification.',
  },
};

const NOTIFICATION_MESSAGES: NotificationMessagesMap = {
  [EnumNotificationI18nType.ORDER_PAID_CLIENT]: {
    [EnumUserLanguage.FR]: {
      title: 'Paiement confirmé',
      body: 'Votre commande a été payée avec succès.',
    },
    [EnumUserLanguage.EN]: {
      title: 'Payment confirmed',
      body: 'Your order has been paid successfully.',
    },
  },

  [EnumNotificationI18nType.ORDER_PAYMENT_FAILED_CLIENT]: {
    [EnumUserLanguage.FR]: {
      title: 'Paiement échoué',
      body: 'Le paiement de votre commande a échoué. Veuillez réessayer.',
    },
    [EnumUserLanguage.EN]: {
      title: 'Payment failed',
      body: 'Your order payment failed. Please try again.',
    },
  },

  [EnumNotificationI18nType.ORDER_PAID_RESTAURANT]: {
    [EnumUserLanguage.FR]: {
      title: 'Nouvelle commande payée',
      body: 'Vous avez reçu une nouvelle commande payée.',
    },
    [EnumUserLanguage.EN]: {
      title: 'New paid order',
      body: 'You have received a new paid order.',
    },
  },

  [EnumNotificationI18nType.ORDER_PREPARING_ORDER]: {
    [EnumUserLanguage.FR]: {
      title: 'Commande en préparation',
      body: 'Le restaurant prépare votre commande.',
    },
    [EnumUserLanguage.EN]: {
      title: 'Order being prepared',
      body: 'The restaurant is preparing your order.',
    },
  },

  [EnumNotificationI18nType.ORDER_IN_DELIVERY]: {
    [EnumUserLanguage.FR]: {
      title: 'Commande en livraison',
      body: 'Votre commande est en route.',
    },
    [EnumUserLanguage.EN]: {
      title: 'Order out for delivery',
      body: 'Your order is on its way.',
    },
  },

  [EnumNotificationI18nType.ORDER_DELIVERED]: {
    [EnumUserLanguage.FR]: {
      title: 'Commande livrée',
      body: 'Votre commande a été livrée. Bon appétit !',
    },
    [EnumUserLanguage.EN]: {
      title: 'Order delivered',
      body: 'Your order has been delivered. Enjoy your meal!',
    },
  },

  [EnumNotificationI18nType.ORDER_CANCELLED_BY_RESTAURANT]: {
    [EnumUserLanguage.FR]: {
      title: 'Commande annulée',
      body: 'Le restaurant a annulé votre commande.',
    },
    [EnumUserLanguage.EN]: {
      title: 'Order cancelled',
      body: 'The restaurant has cancelled your order.',
    },
  },

  [EnumNotificationI18nType.ORDER_STATUS_CHANGED]: {
    [EnumUserLanguage.FR]: {
      title: 'Mise à jour de commande',
      body: 'Le statut de votre commande a changé.',
    },
    [EnumUserLanguage.EN]: {
      title: 'Order update',
      body: 'Your order status has changed.',
    },
  },
};

export function getNotificationMessage(
  type: EnumNotificationI18nType,
  language: EnumUserLanguage = EnumUserLanguage.FR,
): INotificationMessage {
  const messagesForType = NOTIFICATION_MESSAGES[type] ?? FALLBACK_MESSAGE;

  return messagesForType[language] ?? messagesForType[EnumUserLanguage.FR];
}
