import { EventType } from '@enums/event.enums.js';
import { LangGraphEvent } from '../../types/event.types.js';

export function isEventType<T extends LangGraphEvent>(
  event: LangGraphEvent,
  eventType: EventType
): event is T {
  return event.event === eventType;
}

export function getEventType(event: LangGraphEvent): EventType {
  return event.event as EventType;
}
