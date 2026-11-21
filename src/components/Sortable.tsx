import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, ReactNode } from 'react';

interface SortableListProps {
  ids: string[];
  /** Names for screen-reader announcements while dragging. */
  names: Map<string, string>;
  onReorder: (activeId: string, overId: string) => void;
  /**
   * list: a vertical list dragged by its handle, with mouse, touch or keyboard.
   * grid: cards picked up by pressing and holding, so a quick tap still works.
   */
  layout: 'list' | 'grid';
  onDragStart?: () => void;
  onDragEnd?: () => void;
  children: ReactNode;
}

export function SortableList({
  ids,
  names,
  onReorder,
  layout,
  onDragStart,
  onDragEnd,
  children,
}: SortableListProps) {
  const hold = layout === 'grid';
  const mouse = useSensor(
    MouseSensor,
    hold
      ? { activationConstraint: { delay: 350, tolerance: 6 } }
      : { activationConstraint: { distance: 4 } },
  );
  // Touch always waits for a hold, so swiping over the list still scrolls the page.
  const touch = useSensor(TouchSensor, {
    activationConstraint: { delay: hold ? 350 : 200, tolerance: 8 },
  });
  const keyboard = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  // On Sell cards, Enter and Space must keep adding the item, so no keyboard dragging
  // there; the Table list (and the item editor's Move buttons) cover reordering.
  const sensors = useSensors(mouse, touch, hold ? null : keyboard);

  const name = (id: string | number) => names.get(String(id)) ?? 'Item';
  const position = (id: string | number) => ids.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)} is now at position ${position(over.id)} of ${ids.length}.` : '',
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${name(active.id)} at position ${position(over.id)}.` : 'Dropped.',
    onDragCancel: ({ active }) => `Cancelled. ${name(active.id)} is back where it was.`,
  };

  function handleEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
    onDragEnd?.();
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To move this item, press Space. Use the arrow keys to move it, Space to drop, or Escape to cancel.',
        },
      }}
      onDragStart={onDragStart}
      onDragEnd={handleEnd}
      onDragCancel={onDragEnd}
    >
      <SortableContext
        items={ids}
        strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** Wires one element into the surrounding SortableList. */
export function useSortableItem(id: string, disabled = false) {
  const sortable = useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };
  return { ...sortable, style };
}
