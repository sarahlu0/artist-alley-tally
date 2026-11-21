import { useStore } from '../state/store';

interface EventPickerProps {
  value: string;
  onChange: (eventId: string) => void;
}

/** Switch between events. Shows plain text while there is only one. */
export function EventPicker({ value, onChange }: EventPickerProps) {
  const { state } = useStore();
  if (state.events.length < 2) return <p className="muted">{state.events[0].name}</p>;

  return (
    <select
      className="select event-picker"
      value={value}
      aria-label="Event"
      onChange={(e) => onChange(e.target.value)}
    >
      {[...state.events].reverse().map((event) => (
        <option key={event.id} value={event.id}>
          {event.name}
          {event.id === state.currentEventId ? ' (now)' : ''}
        </option>
      ))}
    </select>
  );
}
