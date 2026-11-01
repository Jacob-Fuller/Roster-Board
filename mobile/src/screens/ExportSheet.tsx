import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Button, Chip, SectionHead, Segmented, Sheet, useTheme, useUi } from "../components/ui";
import { MONTHS, addMonths, startOfMonth } from "../lib/model";
import { PDF_PAGE, buildRosterHtml, buildRosterImageHtml, nothingToExport, rosterFileName, rosterFilterOptions, rosterImageName } from "../lib/pdf";
import { useStore } from "../lib/store";

type Mode = "month" | "year";

// PDF roster export. Like the web app's "PDF roster" button (Reports tab), it
// prints either one month or every month of a year, one page per month.
// The opening screen can pass the period it is showing so the sheet starts there.
export function ExportSheet({ visible, onClose, initialMode = "month", initialMonth, initialYear }: {
  visible: boolean;
  onClose: () => void;
  initialMode?: Mode;
  initialMonth?: Date;
  initialYear?: number;
}) {
  const t = useTheme();
  const { toast } = useUi();
  const { data } = useStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [month, setMonth] = useState(startOfMonth(initialMonth || new Date()));
  const [year, setYear] = useState(initialYear ?? new Date().getFullYear());
  const [busy, setBusy] = useState<false | "pdf" | "photo">(false);
  // HTML being drawn to a photo in the hidden view below; cleared when it reports back.
  const [shotHtml, setShotHtml] = useState<string | null>(null);
  // Types left out of the PDF; kept while the app is open so the choice carries between exports.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Start from the caller's period each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setMonth(startOfMonth(initialMonth || new Date()));
    setYear(initialYear ?? new Date().getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const months = useMemo(() => {
    if (mode === "month") return [month];
    return Array.from({ length: 12 }, (_, mi) => new Date(year, mi, 1));
  }, [mode, month, year]);
  const options = useMemo(() => (visible ? rosterFilterOptions(data, months) : []), [visible, data, months]);
  // Live preview of exactly what will be exported.
  const { width: screenW, height: screenH } = useWindowDimensions();
  const previewW = screenW - 36;
  const pageH = (previewW * PDF_PAGE.height) / PDF_PAGE.width;
  const previewH = mode === "month" ? pageH + 4 : Math.min(screenH * 0.55, pageH * 12);
  const previewHtml = useMemo(() => (visible ? buildRosterHtml(data, months, undefined, hidden).replace("</style>",
    "body{background:#E4E2DD}.page{background:#fff;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.25)}</style>") : ""), [visible, data, months, hidden]);

  const label = mode === "month" ? MONTHS[month.getMonth()] + " " + month.getFullYear() : String(year);
  const step = (n: number) => { if (mode === "month") setMonth(addMonths(month, n)); else setYear(year + n); };

  const canExport = () => {
    if (busy) return false;
    if (nothingToExport(data)) { toast("Nothing to export yet"); return false; }
    if (options.length && options.every((o) => hidden.has(o.id))) { toast("Select at least one"); return false; }
    return true;
  };

  const exportPdf = async () => {
    if (!canExport()) return;
    const html = buildRosterHtml(data, months, undefined, hidden);
    setBusy("pdf");
    try {
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html, width: PDF_PAGE.width, height: PDF_PAGE.height });
        if (!(await Sharing.isAvailableAsync())) { toast("Sharing isn't available on this device"); return; }
        // iOS can't show the share sheet on top of this panel, so close it first.
        onClose();
        await new Promise((r) => setTimeout(r, 600));
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: rosterFileName(months) });
        return;
      }
      onClose();
    } catch {
      toast("Couldn't create the PDF");
    } finally {
      setBusy(false);
    }
  };

  const exportPhoto = () => {
    if (!canExport()) return;
    setBusy("photo");
    setShotHtml(buildRosterImageHtml(data, months, undefined, hidden));
  };

  // The hidden view posts back a PNG data URL (or "error:…").
  const onShot = async (msg: string) => {
    setShotHtml(null);
    const name = rosterImageName(months);
    try {
      if (!msg.startsWith("data:image/png;base64,")) throw new Error(msg);
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = msg; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        onClose();
        return;
      }
      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.create();
      file.write(msg.slice(msg.indexOf(",") + 1), { encoding: "base64" });
      if (!(await Sharing.isAvailableAsync())) { toast("Sharing isn't available on this device"); return; }
      onClose();
      await new Promise((r) => setTimeout(r, 600));
      await Sharing.shareAsync(file.uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: name });
    } catch {
      toast("Couldn't create the photo");
    } finally {
      setBusy(false);
    }
  };

  // Web: the iframe posts to this window.
  useEffect(() => {
    if (Platform.OS !== "web" || !shotHtml) return;
    const fn = (e: MessageEvent) => { if (typeof e.data === "string" && (e.data.startsWith("data:image") || e.data.startsWith("error:"))) onShot(e.data); };
    window.addEventListener("message", fn);
    return () => window.removeEventListener("message", fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotHtml]);

  return (
    <Sheet visible={visible} onClose={onClose} title="PDF Roster"
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button style={{ flex: 1 }} title={busy === "pdf" ? "Creating…" : "Export PDF"} onPress={exportPdf} disabled={!!busy} />
          <Button style={{ flex: 1 }} title={busy === "photo" ? "Creating…" : "Export Photo"} onPress={exportPhoto} disabled={!!busy} />
        </View>
      }>
      {shotHtml ? (
        <View pointerEvents="none" style={{ position: "absolute", left: -5000, top: 0, width: PDF_PAGE.width, height: PDF_PAGE.height, opacity: 0 }}>
          {Platform.OS === "web"
            ? React.createElement("iframe", { srcDoc: shotHtml, title: "Photo", style: { width: PDF_PAGE.width, height: PDF_PAGE.height, border: 0 } })
            : <WebView originWhitelist={["*"]} source={{ html: shotHtml }} style={{ width: PDF_PAGE.width, height: PDF_PAGE.height }}
                onMessage={(e) => onShot(e.nativeEvent.data)} onError={() => onShot("error:load")} />}
        </View>
      ) : null}
      <Segmented<Mode> value={mode} onChange={setMode} options={[{ value: "month", label: "Month" }, { value: "year", label: "Year" }]} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 14 }}>
        <Nav label="‹" a11y="Previous" onPress={() => step(-1)} />
        <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>{label}</Text>
        <Nav label="›" a11y="Next" onPress={() => step(1)} />
      </View>
      <View style={{ height: previewH, borderRadius: 8, overflow: "hidden", backgroundColor: "#E4E2DD" }}>
        {Platform.OS === "web"
          ? React.createElement("iframe", { srcDoc: previewHtml, title: "PDF preview", style: { width: "100%", height: "100%", border: 0 } })
          : <WebView originWhitelist={["*"]} source={{ html: previewHtml }} style={{ flex: 1, backgroundColor: "#E4E2DD" }}
              scrollEnabled={mode === "year"} showsVerticalScrollIndicator={false} />}
      </View>
      {options.length ? (
        <>
          <SectionHead title="Show" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {options.map((o) => {
              const on = !hidden.has(o.id);
              return <Chip key={o.id} label={(on ? "✓ " : "") + o.label} color={on ? o.color : t.surface2} ink={on ? o.ink : t.textDim} onPress={() => toggle(o.id)} />;
            })}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

function Nav({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} hitSlop={6}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: "600", marginTop: -2 }}>{label}</Text>
    </Pressable>
  );
}
