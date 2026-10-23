// The launch screen (matches the expo-splash-screen image), drawn again over the app the moment it's ready, so the
// iPhone's launch screen hands over seamlessly. It then lifts and fades away.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet } from "react-native";

// same size and colour as the expo-splash-screen settings in app.json
const SIZE = 300, BG = "#0F2244";
let played = false;

export function LaunchCover() {
  const [show, setShow] = useState(!played && Platform.OS !== "web");
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!show) return;
    played = true;
    Animated.timing(fade, { toValue: 0, duration: 520, delay: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      .start(() => setShow(false));
  }, [show, fade]);
  if (!show) return null;
  const scale = fade.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: BG, alignItems: "center", justifyContent: "center", opacity: fade }]}>
      <Animated.Image source={require("../../assets/splash.png")} style={{ width: SIZE, height: SIZE, transform: [{ scale }] }} resizeMode="contain" />
    </Animated.View>
  );
}
