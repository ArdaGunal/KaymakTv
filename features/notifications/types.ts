export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface PushToken {
  token: string;
  platform: 'web' | 'ios' | 'android';
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}
