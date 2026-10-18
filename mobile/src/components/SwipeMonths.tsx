// A month calendar you can swipe sideways. The months either side sit just off
// screen and move with the finger, so the next month slides into view as this
// one leaves. Used for your own calendar and for a friend's shared roster.
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Platform, View } from "react-native";
import { addMonths } from "../lib/model";

export type MonthSwipe = {
  month: Date; goTo: (next: Date) => void;
  x: Animated.Value; w: number; setWidth: (w: number) => void; panHandlers: any;
};

// month/setMonth come from the screen; `paused` stops swiping (e.g. while mass-editing).
export function useMonthSwipe(month: Date, setMonth: (d: Date) => void, paused?: boolean): MonthSwipe {
  const monthRef = useRef(month); monthRef.current = month;
  const pausedRef = useRef(!!paused); pausedRef.current = !!paused;
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  const widthRef = useRef(0);
  const busy = useRef(false);
  const settle = useRef(false);
  const ND = Platform.OS !== "web";
  // After the month changes, the new month is already in the middle, so the strip jumps back without moving visibly.
  useLayoutEffect(() => {
    if (!settle.current) return;
    settle.current = false;
    x.setValue(0);
    busy.current = false;
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps
  const slide = (dir: number, velocity = 0) => {
    if (!widthRef.current) { setMonth(addMonths(monthRef.current, dir)); return; }
    busy.current = true;
    Animated.timing(x, { toValue: -dir * widthRef.current, duration: velocity > 1 ? 180 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: ND })
      .start(() => { settle.current = true; setMonth(addMonths(monthRef.current, dir)); });
  };
  const goTo = (next: Date) => {
    const cur = monthRef.current;
    const diff = (next.getFullYear() - cur.getFullYear()) * 12 + next.getMonth() - cur.getMonth();
    if (!diff || busy.current) return;
    if (Math.abs(diff) === 1) slide(diff); else setMonth(next);
  };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !pausedRef.current && !busy.current && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => { if (!busy.current) x.setValue(g.dx); },
    onPanResponderRelease: (_, g) => {
      if (busy.current) return;
      const far = Math.abs(g.dx) > widthRef.current * 0.25 || Math.abs(g.vx) > 0.4;
      if (!far) { Animated.spring(x, { toValue: 0, useNativeDriver: ND, bounciness: 3 }).start(); return; }
      slide(g.dx < 0 ? 1 : -1, Math.abs(g.vx));
    },
    onPanResponderTerminate: () => { if (!busy.current) Animated.spring(x, { toValue: 0, useNativeDriver: ND }).start(); },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  return { month, goTo, x, w, setWidth: (v) => { widthRef.current = v; setW(v); }, panHandlers: pan.panHandlers };
}

// Draws the previous, current and next months side by side; renderMonth draws one month.
export function SwipeMonths({ swipe, renderMonth }: { swipe: MonthSwipe; renderMonth: (m: Date, current: boolean) => React.ReactNode }) {
  const { month, x, w } = swipe;
  return (
    <View style={{ flex: 1, overflow: "hidden" }} {...swipe.panHandlers} onLayout={(e) => swipe.setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: x }] }}>
        {w ? (
          <View style={{ position: "absolute", top: 0, bottom: 0, left: -w, width: w * 3, flexDirection: "row" }}>
            <View style={{ width: w }}>{renderMonth(addMonths(month, -1), false)}</View>
            <View style={{ width: w }}>{renderMonth(month, true)}</View>
            <View style={{ width: w }}>{renderMonth(addMonths(month, 1), false)}</View>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
