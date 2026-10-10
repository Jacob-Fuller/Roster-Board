import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  useColorScheme, type StyleProp, type TextStyle, type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useStore } from "../lib/store";
import { dark, light, type Theme } from "../theme";

/* ---------- theme ---------- */
export function useTheme(): Theme {
  const { prefs } = useStore();
  const sys = useColorScheme();
  const isDark = prefs.theme === "dark" || (prefs.theme === "system" && sys === "dark");
  return isDark ? dark : light;
}

// Headings use Fraunces, the same typeface as the website (loaded in App.tsx).
export const SERIF = "Fraunces_700Bold";

/* ---------- text ---------- */
export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ fontFamily: SERIF, fontSize: 26, color: t.text }, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ fontFamily: SERIF, fontSize: 18, color: t.text }, style]}>{children}</Text>;
}
export function Dim({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const t = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ fontSize: 13, color: t.textDim }, style]}>{children}</Text>;
}

/* ---------- containers ---------- */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.surface, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 }, style]}>
      {children}
    </View>
  );
}
export function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 22, marginBottom: 8 }}>
      <H2>{title}</H2>
      {right}
    </View>
  );
}

/* ---------- controls ---------- */
type BtnKind = "primary" | "ghost" | "danger" | "outline" | "outlineDanger";
export function Button({ title, onPress, kind = "primary", disabled, style, small }: {
  title: string; onPress: () => void; kind?: BtnKind; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const t = useTheme();
  const outline = kind === "outline" || kind === "outlineDanger";
  const bg = kind === "primary" ? t.accent : kind === "danger" ? t.danger : outline ? t.surface : t.surface2;
  const fg = kind === "primary" ? t.accentInk : kind === "danger" ? "#FFFFFF" : kind === "outlineDanger" ? t.danger : t.text;
  const border = kind === "outlineDanger" ? t.danger : outline ? t.border : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{
        backgroundColor: bg, borderRadius: 12, borderWidth: outline ? 1.5 : 0, borderColor: border, paddingVertical: small ? 9 : 13, paddingHorizontal: small ? 12 : 16,
        alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      }, style]}
    >
      <Text style={{ color: fg, fontWeight: "700", fontSize: small ? 14 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function LinkText({ title, onPress, color }: { title: string; onPress: () => void; color?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Text style={{ color: color || t.accent, fontWeight: "600", fontSize: 14 }}>{title}</Text>
    </Pressable>
  );
}

export function Field(props: React.ComponentProps<typeof TextInput> & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={{ fontSize: 13, color: t.textDim, marginBottom: 6, fontWeight: "600" }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.textFaint}
        {...rest}
        style={[{
          borderWidth: 1, borderColor: t.border, backgroundColor: t.surface2, color: t.text, borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 9, fontSize: 16,
        }, style]}
      />
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.surface2, borderRadius: 11, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center", backgroundColor: on ? t.surface : "transparent" }}
          >
            <Text style={{ fontWeight: "600", fontSize: 14, color: on ? t.text : t.textDim }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ label, value, onChange, sub }: { label: string; value: boolean; onChange: (v: boolean) => void; sub?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15 }}>{label}</Text>
        {sub ? <Dim>{sub}</Dim> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.accent, false: t.surface2 }} thumbColor="#FFFFFF" ios_backgroundColor={t.surface2} />
    </View>
  );
}

export function MenuRow({ title, sub, onPress, danger, right, center }: { title: string; sub?: string; onPress: () => void; danger?: boolean; right?: string; center?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1, alignItems: center ? "center" : "flex-start" }}>
        <Text style={{ color: danger ? t.danger : t.text, fontSize: 15, fontWeight: "600" }}>{title}</Text>
        {sub ? <Dim>{sub}</Dim> : null}
      </View>
      {right ? <Dim>{right}</Dim> : null}
      {center ? null : <Text style={{ color: t.textFaint, fontSize: 20 }}>›</Text>}
    </Pressable>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border }} />;
}

/* ---------- bottom sheet ---------- */
export function Sheet({ visible, onClose, title, children, footer }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const layer = useContext(LayerContext);
  const id = useRef(Math.random().toString(36).slice(2)).current;
  useEffect(() => {
    if (!visible) return;
    layer.push(id);
    return () => layer.pop(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const onTop = visible && layer.top === id;
  return (
    <Modal statusBarTranslucent navigationBarTranslucent visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={Platform.OS === "web"}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: t.bg }}>
        {Platform.OS === "android" ? <StatusBar style={t.dark ? "light" : "dark"} /> : null}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? insets.top + 12 : 16, paddingBottom: 10, gap: 10 }}>
          <H2 style={{ flex: 1, fontSize: 20 }}>{title}</H2>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.textDim, fontSize: 15, fontWeight: "700" }}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: footer ? 24 : 24 + (Platform.OS === "android" ? insets.bottom : 0) }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 14), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }}>{footer}</View> : null}
      </KeyboardAvoidingView>
      {/* iOS can't show a second pop-up over an open sheet, so the sheet on top shows dialogs and messages itself */}
      {onTop ? <Overlays /> : null}
    </Modal>
  );
}

/* ---------- small prompt / confirm dialog ---------- */
type DialogOpts = {
  title: string; message?: string; input?: { placeholder?: string; value?: string; keyboard?: "default" | "decimal-pad" | "email-address" };
  confirm?: string; cancel?: string; danger?: boolean; onConfirm: (value: string) => void;
};
type UiCtx = { dialog: (o: DialogOpts) => void; toast: (msg: string) => void };
const UiContext = createContext<UiCtx>({ dialog: () => {}, toast: () => {} });
export const useUi = () => useContext(UiContext);

// Which sheets are open, so dialogs and messages appear in the one on top.
type LayerCtx = { top: string | null; push: (id: string) => void; pop: (id: string) => void };
const LayerContext = createContext<LayerCtx>({ top: null, push: () => {}, pop: () => {} });
type OverlayState = {
  opts: DialogOpts | null; val: string; setVal: (v: string) => void; close: () => void;
  msg: string; fade: Animated.Value;
};
const OverlayContext = createContext<OverlayState | null>(null);

function DialogBox() {
  const t = useTheme();
  const o = useContext(OverlayContext);
  if (!o || !o.opts) return null;
  const { opts, val, setVal, close } = o;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 28 }}>
      <View style={{ backgroundColor: t.surface, borderRadius: 18, padding: 18 }}>
        <H2 style={{ marginBottom: opts.message ? 6 : 12 }}>{opts.title}</H2>
        {opts.message ? <Text style={{ color: t.textDim, fontSize: 14, marginBottom: 14, lineHeight: 20 }}>{opts.message}</Text> : null}
        {opts.input ? (
          <Field autoFocus value={val} onChangeText={setVal} placeholder={opts.input.placeholder}
            keyboardType={opts.input.keyboard || "default"} autoCapitalize="none" onSubmitEditing={() => { close(); opts.onConfirm(val); }} />
        ) : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button style={{ flex: 1 }} kind="ghost" title={opts.cancel || "Cancel"} onPress={close} />
          <Button style={{ flex: 1 }} kind={opts.danger ? "danger" : "primary"} title={opts.confirm || "Save"} onPress={() => { close(); opts.onConfirm(val); }} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ToastView() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const o = useContext(OverlayContext);
  if (!o) return null;
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 84, alignItems: "center", opacity: o.fade }}>
      <View style={{ backgroundColor: t.dark ? "#F3EEE6" : "#14181F", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }}>
        <Text style={{ color: t.dark ? "#14181F" : "#FFFFFF", fontWeight: "600" }}>{o.msg}</Text>
      </View>
    </Animated.View>
  );
}

// Dialog and message drawn inside an open sheet (no separate pop-up window).
function Overlays() {
  const o = useContext(OverlayContext);
  return (
    <>
      {o && o.opts ? <View style={StyleSheet.absoluteFill}><DialogBox /></View> : null}
      <ToastView />
    </>
  );
}

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<DialogOpts | null>(null);
  const [val, setVal] = useState("");
  const [msg, setMsg] = useState("");
  const [stack, setStack] = useState<string[]>([]);
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dialog = useCallback((o: DialogOpts) => { setVal(o.input?.value || ""); setOpts(o); }, []);
  const toast = useCallback((m: string) => {
    setMsg(m);
    Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== "web" }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== "web" }).start(), 1900);
  }, [fade]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const close = useCallback(() => setOpts(null), []);
  const push = useCallback((id: string) => setStack((s) => s.filter((x) => x !== id).concat(id)), []);
  const pop = useCallback((id: string) => setStack((s) => s.filter((x) => x !== id)), []);
  const top = stack.length ? stack[stack.length - 1] : null;
  const ui = useMemo(() => ({ dialog, toast }), [dialog, toast]);
  const layer = useMemo(() => ({ top, push, pop }), [top, push, pop]);
  const overlay = { opts, val, setVal, close, msg, fade };
  return (
    <UiContext.Provider value={ui}>
      <LayerContext.Provider value={layer}>
        <OverlayContext.Provider value={overlay}>
          {children}
          {!top ? (
            <>
              <Modal statusBarTranslucent navigationBarTranslucent visible={!!opts} transparent animationType="fade" onRequestClose={close}>
                <DialogBox />
              </Modal>
              <ToastView />
            </>
          ) : null}
        </OverlayContext.Provider>
      </LayerContext.Provider>
    </UiContext.Provider>
  );
}

/* ---------- colour chip ---------- */
export function Chip({ label, color, ink, onPress, selected, small }: { label: string; color: string; ink: string; onPress?: () => void; selected?: boolean; small?: boolean }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({
        backgroundColor: color, borderRadius: 999, paddingHorizontal: small ? 10 : 13, paddingVertical: small ? 5 : 8,
        opacity: pressed ? 0.8 : 1, borderWidth: 2, borderColor: selected ? "#FFFFFF" : "transparent",
      })}>
      <Text style={{ color: ink, fontWeight: "700", fontSize: small ? 12 : 14 }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
