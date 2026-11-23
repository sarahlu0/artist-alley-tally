import { useRef, useState, type DragEvent } from 'react';

function carriesFiles(event: DragEvent) {
  return event.dataTransfer.types.includes('Files');
}

/**
 * Drag-and-drop handlers for a file drop target. `dragging` is true while files
 * are held over the target. Only the first dropped file is passed on.
 */
export function useFileDrop(onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false);
  // dragenter and dragleave also fire when moving between child elements.
  const depth = useRef(0);

  const dropProps = {
    onDragEnter(event: DragEvent) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver(event: DragEvent) {
      if (!carriesFiles(event)) return;
      // Without this the browser refuses the drop.
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave(event: DragEvent) {
      if (!carriesFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop(event: DragEvent) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) onFile(file);
    },
  };

  return { dragging, dropProps };
}
