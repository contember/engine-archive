import { copy, pathExists } from 'fs-extra'
import { join } from 'path'
import { resourcesDir } from '../pathUtils'
import { createInstance } from './instance'
import { createProject, registerProjectToInstance } from './project'
import { readYaml } from './yaml'

export const createWorkspace = async ({
	workspaceDirectory,
	withAdmin,
}: {
	withAdmin: boolean
	workspaceDirectory: string
}) => {
	const template = withAdmin ? 'workspace-template' : 'workspace-no-admin-template'
	await copy(join(resourcesDir, template), workspaceDirectory)

	const instance = await createInstance({ workspaceDirectory, instanceName: 'default' })
	await createProject({ workspaceDirectory, projectName: 'sandbox' })
	await registerProjectToInstance({ projectName: 'sandbox', ...instance })
}

export interface WorkspaceConfig {
	version?: string
	admin?: {
		enabled?: boolean
	}
}

export const readWorkspaceConfig = async ({
	workspaceDirectory,
}: {
	workspaceDirectory: string
}): Promise<WorkspaceConfig> => {
	const configPath = join(workspaceDirectory, 'contember.workspace.yaml')
	if (!(await pathExists(configPath))) {
		return {}
	}
	return await readYaml(configPath)
}

export const hasInstanceAdmin = async ({ workspaceDirectory }: { workspaceDirectory: string }): Promise<boolean> => {
	const workspaceConfig = await readWorkspaceConfig({ workspaceDirectory })
	return workspaceConfig?.admin?.enabled || false
}
