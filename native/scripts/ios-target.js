// Raises the iOS minimum version of the generated Xcode project. The purchase
// plugin (StoreKit 2) needs a newer iOS than Capacitor's default.
// Run from the native/ folder after `npx cap add ios`.
const fs = require("fs");
const path = require("path");
const TARGET = "16.0";
const podfile = path.join(__dirname, "..", "ios", "App", "Podfile");
const pbx = path.join(__dirname, "..", "ios", "App", "App.xcodeproj", "project.pbxproj");
if (fs.existsSync(podfile)) {
  let s = fs.readFileSync(podfile, "utf8");
  s = s.replace(/platform :ios, '[\d.]+'/, `platform :ios, '${TARGET}'`);
  fs.writeFileSync(podfile, s);
}
if (fs.existsSync(pbx)) {
  let s = fs.readFileSync(pbx, "utf8");
  s = s.replace(/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;/g, `IPHONEOS_DEPLOYMENT_TARGET = ${TARGET};`);
  fs.writeFileSync(pbx, s);
}
console.log("iOS deployment target set to", TARGET);
