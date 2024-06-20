import { MailType as SchemaMailType } from '../../schema'

export enum MailType {
	existingUserInvited = 'existingUserInvited',
	newUserInvited = 'newUserInvited',
	passwordReset = 'passwordReset',
}

export const mailTypeFromSchemaToDb = (type: SchemaMailType): MailType => {
	return {
		EXISTING_USER_INVITED: MailType.existingUserInvited,
		NEW_USER_INVITED: MailType.newUserInvited,
		RESET_PASSWORD_REQUEST: MailType.passwordReset,
	}[type]
}

export const mailTypeFromDbToSchema = (type: MailType): SchemaMailType => {
	return {
		[MailType.existingUserInvited]: 'EXISTING_USER_INVITED' as const,
		[MailType.newUserInvited]: 'NEW_USER_INVITED' as const,
		[MailType.passwordReset]: 'RESET_PASSWORD_REQUEST' as const,
	}[type]
}

export interface MailTemplateIdentifier {
	projectId: string | null
	type: MailType
	variant: string
}

export interface MailTemplateData {
	subject: string
	content: string
	useLayout: boolean
	replyTo: string | null
}

export interface MailTemplate extends MailTemplateIdentifier, MailTemplateData {}
