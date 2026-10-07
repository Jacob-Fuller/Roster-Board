import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Button, Segmented, Sheet, useTheme, useUi } from "../components/ui";
import { MONTHS, addMonths, startOfMonth } from "../lib/model";
import { PDF_PAGE, buildRosterHtml, nothingToExport, rosterFileName } from "../lib/pdf";
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
  const [busy, setBusy] = useState(false);

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
  // Live preview of exactly what will be exported.
  const { width: screenW, height: screenH } = useWindowDimensions();
  const previewW = screenW - 36;
  const pageH = (previewW * PDF_PAGE.height) / PDF_PAGE.width;
  const previewH = mode === "month" ? pageH + 4 : Math.min(screenH * 0.55, pageH * 12);
  const previewHtml = useMemo(() => (visible ? buildRosterHtml(data, months).replace("</style>",
    "body{background:#E4E2DD}.page{margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.25)}</style>") : ""), [visible, data, months]);

  const label = mode === "month" ? MONTHS[month.getMonth()] + " " + month.getFullYear() : String(year);
  const step = (n: number) => { if (mode === "month") setMonth(addMonths(month, n)); else setYear(year + n); };

  const exportPdf = async () => {
    if (busy) return;
    if (nothingToExport(data)) { toast("Nothing to export yet"); return; }
    const html = buildRosterHtml(data, months);
    setBusy(true);
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

  return (
    <Sheet visible={visible} onClose={onClose} title="PDF roster"
      footer={<Button title={busy ? "Creating PDF…" : "Export PDF"} onPress={exportPdf} disabled={busy} />}>
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
