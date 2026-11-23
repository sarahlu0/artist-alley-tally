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
  /** Item names for drag announcements. */
  names: Map<string, string>;
  onReorder: (activeId: string, overId: string) => void;
  /**
   * list: dragged by a handle, with mouse, touch or keyboard.
   * grid: picked up by press-and-hold so a quick click still activates the card.
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
  // Touch always needs a hold, so swiping still scrolls the page.
  const touch = useSensor(TouchSensor, {
    activationConstraint: { delay: hold ? 350 : 200, tolerance: 8 },
  });
  const keyboard = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  // Grid cards are buttons where Enter and Space add the item, so they get no keyboard
  // sensor; reordering by keyboard is done in the list layout or with Move up/down.
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

export function useSortableItem(id: string, disabled = false) {
  const sortable = useSortable({ id, disabled });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };
  return { ...sortable, style };
}
