import { FileImage, FileText, X } from "lucide-react";
import { useState } from "react";
import { downloadPdf, downloadPng, downloadSvg } from "../export/download";
import { useProjectStore } from "../store/projectStore";

interface ExportDialogProps {
  onClose: () => void;
}

export function ExportDialog({ onClose }: ExportDialogProps) {
  const project = useProjectStore((state) => state.project);
  const setError = useProjectStore((state) => state.setError);
  const [includeDimensions, setIncludeDimensions] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const run = async (format: "svg" | "pdf" | "png") => {
    setWorking(format);
    try {
      if (format === "svg") downloadSvg(project, includeDimensions);
      if (format === "pdf") await downloadPdf(project, includeDimensions);
      if (format === "png") await downloadPng(project, includeDimensions);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setWorking(null);
    }
  };
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">Portable output</p><h2 id="export-title">Export plan</h2></div>
          <button type="button" className="icon-button" aria-label="Close export dialog" onClick={onClose}><X size={18} /></button>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={includeDimensions} onChange={(event) => setIncludeDimensions(event.target.checked)} />
          <span><strong>Include dimensions</strong><small>Wall lengths and opening widths; furniture dimensions stay hidden.</small></span>
        </label>
        <div className="export-options">
          <button type="button" disabled={working !== null} onClick={() => void run("pdf")}><FileText size={22} /><span><strong>PDF</strong><small>Vector · US Letter landscape</small></span></button>
          <button type="button" disabled={working !== null} onClick={() => void run("png")}><FileImage size={22} /><span><strong>PNG</strong><small>3300 × 2550 · 300 DPI</small></span></button>
          <button type="button" disabled={working !== null} onClick={() => void run("svg")}><FileImage size={22} /><span><strong>SVG</strong><small>Native vector geometry</small></span></button>
        </div>
      </section>
    </div>
  );
}
