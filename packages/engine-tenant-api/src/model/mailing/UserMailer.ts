import { Mailer, TemplateRenderer } from '../../utils'
import NewUserInvited from './templates/NewUserInvited.mustache'
import ExistingUserInvited from './templates/ExistingUserInvited.mustache'
import PasswordReset from './templates/PasswordReset.mustache'
import { MailTemplateData, MailTemplateIdentifier, MailType } from './type'
import { MailTemplateQuery } from '../queries'
import Layout from './templates/Layout.mustache'
import { DatabaseContext } from '../utils'

export class UserMailer {
	constructor(
		private readonly mailer: Mailer,
		private readonly templateRenderer: TemplateRenderer,
	) { }

	async sendNewUserInvitedMail(
		dbContext: DatabaseContext,
		mailArguments: { email: string; password: string | null; token: string | null; project: string; projectSlug: string },
		customMailOptions: { projectId: string; variant: string },
	): Promise<void> {
		const template = (await this.getCustomTemplate(dbContext, { type: MailType.newUserInvited, ...customMailOptions })) || {
			subject: 'You have been invited to {{project}}',
			content: NewUserInvited,
			replyTo: null,
		}
		await this.sendTemplate(template, mailArguments)
	}

	async sendExistingUserInvitedEmail(
		dbContext: DatabaseContext,
		mailArguments: { email: string; project: string; projectSlug: string },
		customMailOptions: { projectId: string; variant: string },
	): Promise<void> {
		const template = (await this.getCustomTemplate(dbContext, { type: MailType.existingUserInvited, ...customMailOptions })) || {
			subject: 'You have been invited to {{project}}',
			content: ExistingUserInvited,
			replyTo: null,
		}
		await this.sendTemplate(template, mailArguments)
	}

	async sendPasswordResetEmail(
		dbContext: DatabaseContext,
		mailArguments: { email: string; token: string; project?: string; projectSlug?: string },
		customMailOptions: { projectId?: string; variant: string },
	): Promise<void> {
		const template = (await this.getCustomTemplate(dbContext, { type: MailType.passwordReset, ...customMailOptions })) || {
			subject: 'Password reset',
			content: PasswordReset,
			replyTo: null,
		}
		await this.sendTemplate(template, mailArguments)
	}

	private async sendTemplate(
		template: Pick<MailTemplateData, 'subject' | 'content' | 'replyTo'>,
		mailArguments: Record<string, any>,
	) {
		const html = await this.templateRenderer.render(template.content, mailArguments)
		await this.mailer.send({
			to: mailArguments.email,
			subject: await this.templateRenderer.render(template.subject, mailArguments),
			html,
			...(template.replyTo ? {
				replyTo: template.replyTo,
			} : {}),
		})
	}

	private async getCustomTemplate(
		dbContext: DatabaseContext,
		identifier: MailTemplateIdentifier,
	): Promise<Pick<MailTemplateData, 'subject' | 'content' | 'replyTo'> | null> {
		const customTemplate =
			(await dbContext.queryHandler.fetch(new MailTemplateQuery(identifier)))
			?? (await dbContext.queryHandler.fetch(new MailTemplateQuery({ ...identifier, projectId: undefined })))

		if (!customTemplate) {
			return null
		}
		const content = customTemplate.useLayout ? Layout(customTemplate.content) : customTemplate.content
		return { content, subject: customTemplate.subject, replyTo: customTemplate.replyTo }
	}
}
