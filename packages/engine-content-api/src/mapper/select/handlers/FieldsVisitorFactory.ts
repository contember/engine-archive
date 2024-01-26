import { FieldsVisitor } from './FieldsVisitor'
import { RelationFetcher } from '../RelationFetcher'
import { Mapper } from '../../Mapper'
import { SelectExecutionHandlerContext } from '../SelectExecutionHandler'
import { Permissions } from '../../../acl'
import { Settings } from '@contember/schema'

export class FieldsVisitorFactory {
	constructor(
		private readonly relationFetcher: RelationFetcher,
		private readonly permissions: Permissions,
		private readonly settings: Settings.ContentSettings,
	) {}

	create(mapper: Mapper, context: SelectExecutionHandlerContext): FieldsVisitor {
		return new FieldsVisitor(
			this.relationFetcher,
			this.permissions,
			mapper,
			context,
			context.relationPath,
			this.settings,
		)
	}
}
