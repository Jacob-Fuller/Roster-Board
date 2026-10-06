import React, { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Button, Dim, Segmented, Sheet, useTheme, useUi } from "../components/ui";
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

  const label = mode === "month" ? MONTHS[month.getMonth()] + " " + month.getFullYear() : String(year);
  const step = (n: number) => { if (mode === "month") setMonth(addMonths(month, n)); else setYear(year + n); };

  const exportPdf = async () => {
    if (busy) return;
    if (nothingToExport(data)) { toast("Nothing to export yet"); return; }
    const months: Date[] = [];
    if (mode === "year") for (let mi = 0; mi < 12; mi++) months.push(new Date(year, mi, 1));
    else months.push(month);
    const html = buildRosterHtml(data, months);
    setBusy(true);
    try {
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html, width: PDF_PAGE.width, height: PDF_PAGE.height });
        if (!(await Sharing.isAvailableAsync())) { toast("Sharing isn't available on this device"); return; }
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: rosterFileName(months) });
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
      <Dim>
        {mode === "month"
          ? "One A4 landscape page with this month's shifts and leave."
          : "Twelve A4 landscape pages, one for each month of the year."}
      </Dim>
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
