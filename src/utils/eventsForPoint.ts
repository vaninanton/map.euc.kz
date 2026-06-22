import type { EventRow } from '@/types'

/** События, для которых точка с указанным id является стартом или финишем. */
export function eventsForPoint(events: EventRow[], pointId: string): EventRow[] {
    return events.filter((event) => event.start_point?.id === pointId || event.finish_point?.id === pointId)
}
