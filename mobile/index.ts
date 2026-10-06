import "react-native-url-polyfill/auto";
import * as Crypto from "expo-crypto";
import { registerRootComponent } from "expo";
import App from "./App";

// Same record ids as the web app (UUIDs).
const g: any = globalThis as any;
if (!g.crypto) g.crypto = {};
if (typeof g.crypto.randomUUID !== "function") g.crypto.randomUUID = () => Crypto.randomUUID();

registerRootComponent(App);
