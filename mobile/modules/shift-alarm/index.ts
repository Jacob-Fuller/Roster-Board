// Real alarms before shifts on iPhone (Apple's AlarmKit, iOS 26 and later).
// Returns null where the native module isn't available (web, Android, Expo Go).
import { requireOptionalNativeModule } from "expo-modules-core";

export type ShiftAlarmItem = { at: number; title: string };
type Native = {
  isAvailable(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  setAlarms(alarms: ShiftAlarmItem[]): Promise<number>;
};

export const ShiftAlarm = requireOptionalNativeModule<Native>("ShiftAlarm");
