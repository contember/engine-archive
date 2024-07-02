import { gql } from 'graphql-tag'
import { DocumentNode } from 'graphql'

const schema: DocumentNode = gql`
	schema {
		mutation: Mutation
	}

	type Mutation {
		truncate: TruncateResponse!
		forceMigrate(migrations: [Migration!]!): MigrateResponse!
		migrationAmend(input: MigrationAmend!): MigrationAmendResponse!
		
		migrationModify(migration: String!, modification: MigrationModification!): MigrationModifyResponse!
		@deprecated(reason: "Use migrationAmend instead")
		migrationDelete(migration: String!): MigrationDeleteResponse!
		@deprecated(reason: "Use migrationAmend instead")
	}

	type TruncateResponse {
		ok: Boolean!
	}

    input MigrationAmend {
        version: String!
        name: String!
        formatVersion: Int!
        modifications: [Json!]!
    }
	
	type MigrationAmendResponse {
		ok: Boolean!
		error: MigrationAmendError
    }
	
	enum MigrationAmendErrorCode {
		NOT_FOUND
        INVALID_FORMAT
        INVALID_SCHEMA
        MIGRATION_FAILED
    }
	
	type MigrationAmendError {
		code: MigrationAmendErrorCode!
		developerMessage: String!
    }
	

    input MigrationModification {
		version: String
		name: String
		formatVersion: Int
		modifications: [Json!]
	}

	enum MigrationModifyErrorCode {
		NOT_FOUND
	}

	type MigrationModifyError {
		code: MigrationModifyErrorCode!
		developerMessage: String!
	}

	type MigrationModifyResponse {
		ok: Boolean!
		error: MigrationModifyError
	}

	enum MigrationDeleteErrorCode {
		NOT_FOUND
		INVALID_FORMAT
	}

	type MigrationDeleteError {
		code: MigrationDeleteErrorCode!
		developerMessage: String!
	}

	type MigrationDeleteResponse {
		ok: Boolean!
		error: MigrationDeleteError
	}
`

export default schema
