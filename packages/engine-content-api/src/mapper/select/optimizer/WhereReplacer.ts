import { Input, Writable } from '@contember/schema'
import deepEqual from 'fast-deep-equal'

export const replaceWhere = <T extends Input.Where>(subject: T, find: Input.OptionalWhere, replace: Input.Where): T => {
	if (deepEqual(subject, find)) {
		return replace
	}
	let result: Writable<T> = subject
	let copied = false
	for (const key in subject) {
		const value = subject[key]
		if (key === 'not') {
			const newNot = replaceWhere(value as T, find, replace)
			if (newNot !== value) {
				if (!copied) {
					result = { ...result }
				}
				result['not'] = newNot
			}
		} else if (key === 'and' || key === 'or') {
			const items: Input.OptionalWhere[] = []
			let itemChanged = false
			for (const el of value as Input.OptionalWhere[]) {
				const newEl = replaceWhere(el, find, replace)
				if (newEl !== el) {
					itemChanged = true
				}
				items.push(newEl)
			}
			if (itemChanged) {
				if (!copied) {
					result = { ...result }
				}
				result[key] = items
			}
		}
	}
	return result
}
