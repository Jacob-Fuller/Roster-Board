// Hands the home screen widget its data (iPhone only). Null where the native module isn't available.
import { requireOptionalNativeModule } from "expo-modules-core";

type Native = { setData(json: string): Promise<boolean> };
export const WidgetBridge = requireOptionalNativeModule<Native>("WidgetBridge");
