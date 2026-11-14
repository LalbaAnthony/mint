import {
  insertNodeAt,
  removeNode,
  useSortable,
} from '@vueuse/integrations/useSortable'
import type { SortableEvent } from 'sortablejs'
import type { Ref } from 'vue'
import type { SortableListOptions } from '~~/types/referentials'

export function useSortableList(
  target: Ref<HTMLElement | null>,
  options: SortableListOptions,
) {
  useSortable(target, [], {
    watchElement: true,
    handle: `[data-drag-handle="${options.scope}"]`,
    draggable: `[data-sortable-item="${options.scope}"]`,
    animation: 0,
    onUpdate: (event: SortableEvent) => {
      const { oldIndex, newIndex, item, from } = event
      if (oldIndex === undefined || newIndex === undefined) {
        return
      }
      removeNode(item)
      insertNodeAt(from, item, oldIndex)
      options.onReorder(moveItem(options.ids(), oldIndex, newIndex))
    },
  })

  function move(index: number, offset: number): void {
    const ids = options.ids()
    const destination = index + offset
    if (destination < 0 || destination >= ids.length) {
      return
    }
    options.onReorder(moveItem(ids, index, destination))
  }

  return { move }
}
