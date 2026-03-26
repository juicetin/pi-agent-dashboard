import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Icon from "@mdi/react";
import { mdiDragHorizontalVariant } from "@mdi/js";

interface Props {
  id: string;
  children: React.ReactNode;
}

export function SortableSessionCard({ id, children }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className="group/sortable">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/sortable:opacity-60 transition-opacity z-10"
        data-testid="drag-handle-session"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon path={mdiDragHorizontalVariant} size={0.55} className="text-[var(--text-tertiary)]" />
      </div>
      {children}
    </div>
  );
}
