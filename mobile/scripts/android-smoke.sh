#!/usr/bin/env bash
# Installs the test APK on an emulator, taps through the first screens and
# saves screenshots to out/emu-*.png (run from mobile/).
set -u
OUT=out
tap_text() { # tap the first on-screen element whose text matches $1
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml /tmp/ui.xml >/dev/null 2>&1
  local b
  b=$(python3 - "$1" <<'PY'
import re,sys
x=open('/tmp/ui.xml',encoding='utf-8').read()
for m in re.finditer(r'<node [^>]*>', x):
    n=m.group(0)
    t=re.search(r' text="([^"]*)"', n); d=re.search(r' content-desc="([^"]*)"', n)
    if (t and t.group(1)==sys.argv[1]) or (d and d.group(1)==sys.argv[1]):
        a=list(map(int,re.findall(r'\d+', re.search(r'bounds="([^"]*)"', n).group(1))))
        print((a[0]+a[2])//2, (a[1]+a[3])//2); break
PY
)
  if [ -n "$b" ]; then adb shell input tap $b; echo "tapped $1"; else echo "not found: $1"; fi
}
shot() { sleep "${2:-3}"; adb exec-out screencap -p > "$OUT/emu-$1.png"; echo "shot $1"; }

adb install -r "$OUT/RosterBoard-test.apk"
adb shell monkey -p net.rosterboard.app -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
shot 1-sign-in 12
tap_text "Use without an account"; shot 2-welcome 4
tap_text "Skip"; shot 3-calendar 4
tap_text "Mass-edit shifts"; shot 4-mass-edit 3
tap_text "Done"
tap_text "Types"; shot 5-types 3
tap_text "+ New type"; shot 6-new-type 3
adb shell input keyevent KEYCODE_BACK; sleep 1
tap_text "Account"; shot 7-account 3
adb logcat -d -s ReactNativeJS:V AndroidRuntime:E > "$OUT/emu-logcat.txt" 2>/dev/null || true
exit 0
