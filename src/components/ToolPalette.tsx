import { Armchair, DoorOpen, MousePointer2, PencilRuler, RectangleHorizontal, Rows3, SquareSplitHorizontal } from "lucide-react";
import { FURNITURE_CATALOG } from "../domain/defaults";
import type { FurnitureType, Tool } from "../domain/types";
import { useProjectStore } from "../store/projectStore";

interface ToolPaletteProps {
  roomReady: boolean;
}

const tools: Array<{ id: Tool; label: string; icon: typeof MousePointer2; requiresRoom?: boolean }> = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "wall", label: "Draw wall", icon: PencilRuler },
  { id: "rectangle", label: "Rectangle room", icon: RectangleHorizontal },
  { id: "door", label: "Door", icon: DoorOpen, requiresRoom: true },
  { id: "window", label: "Window", icon: SquareSplitHorizontal, requiresRoom: true },
];

export function ToolPalette({ roomReady }: ToolPaletteProps) {
  const tool = useProjectStore((state) => state.tool);
  const setTool = useProjectStore((state) => state.setTool);
  const selectedFurnitureType = useProjectStore((state) => state.selectedFurnitureType);
  const setSelectedFurnitureType = useProjectStore((state) => state.setSelectedFurnitureType);
  return (
    <aside className="tool-palette" aria-label="Drawing tools">
      <div className="panel-heading"><span>Tools</span><span className="panel-index">01</span></div>
      <nav className="tool-list">
        {tools.map(({ id, label, icon: Icon, requiresRoom }) => (
          <button type="button" key={id} className={"tool-item " + (tool === id ? "active" : "")} disabled={requiresRoom && !roomReady} onClick={() => setTool(id)} title={requiresRoom && !roomReady ? "Close the room first" : label}>
            <Icon size={18} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="panel-section-heading"><Armchair size={16} /><span>Furniture</span></div>
      <div className="catalog" role="group" aria-label="Furniture catalog">
        {(Object.entries(FURNITURE_CATALOG) as Array<[FurnitureType, (typeof FURNITURE_CATALOG)[FurnitureType]]>).map(([type, definition]) => (
          <button type="button" key={type} disabled={!roomReady} className={"catalog-item " + (tool === "furniture" && selectedFurnitureType === type ? "active" : "")} onClick={() => setSelectedFurnitureType(type)}>
            <Rows3 size={14} /><span>{definition.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
