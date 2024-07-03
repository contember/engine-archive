import { Authorizator } from '@contember/authorization'

export namespace AuthorizationActions {
	export enum Resources {
		project = 'project',
	}

	export const PROJECT_HISTORY_ANY = Authorizator.createAction(Resources.project, 'historyAny')

	export const PROJECT_MIGRATE = Authorizator.createAction(Resources.project, 'migrate')
	export const PROJECT_LIST_MIGRATIONS = Authorizator.createAction(Resources.project, 'listMigrations')
	export const PROJECT_SHOW_SCHEMA = Authorizator.createAction(Resources.project, 'showSchema')
}
