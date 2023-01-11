import { expect, test } from 'vitest'
import { GraphqlToSchemaConverter } from '../../../src/generator/GraphqlToSchemaConverter'

const schema = `type Tweet {
  content: String
  dateTimePosted: String
  user: User
  likes: [Like]
  retweets: [Retweet]
  hashtags: [Hashtag]
  mentions: [Mention]
}

type User {
  username: String
  profilePicture: String
  bio: String
  followers: [User]
  following: [User]
  tweets: [Tweet]
  likes: [Like]
  retweets: [Retweet]
}

type Like {
  user: User
  tweet: Tweet
}

type Retweet {
  user: User
  tweet: Tweet
}

type Hashtag {
  tag: String
  relatedTweets: [Tweet]
}

type Mention {
  user: User
  tweet: Tweet
}

type Follow {
  user: User
  userBeingFollowed: User
}

type DirectMessage {
  sender: User
  receiver: User
  content: String
  dateTimeSent: String
}`
const converter = new GraphqlToSchemaConverter()
test('scalars', () => {

	expect(converter.convert(`type Article {
		title: String!
		content: String
		publishedAt: DateTime
	}`)).toMatchInlineSnapshot(`
		{
		  "entities": {
		    "Article": {
		      "eventLog": {
		        "enabled": true,
		      },
		      "fields": {
		        "content": {
		          "columnName": "content",
		          "columnType": "text",
		          "name": "content",
		          "nullable": true,
		          "type": "String",
		        },
		        "id": {
		          "columnName": "id",
		          "columnType": "uuid",
		          "name": "id",
		          "nullable": false,
		          "type": "Uuid",
		        },
		        "publishedAt": {
		          "columnName": "published_at",
		          "columnType": "timestamptz",
		          "name": "publishedAt",
		          "nullable": true,
		          "type": "DateTime",
		        },
		        "title": {
		          "columnName": "title",
		          "columnType": "text",
		          "name": "title",
		          "nullable": false,
		          "type": "String",
		        },
		      },
		      "indexes": {},
		      "name": "Article",
		      "primary": "id",
		      "primaryColumn": "id",
		      "tableName": "article",
		      "unique": {},
		    },
		  },
		  "enums": {},
		}
	`)
})

test('enums', () => {
	expect(converter.convert(`
	enum ArticleState {
		PUBLISHED
		DRAFT
	}
	type Article {
		title: String!
		state: ArticleState	
	}
	`)).toMatchInlineSnapshot(`
		{
		  "entities": {
		    "Article": {
		      "eventLog": {
		        "enabled": true,
		      },
		      "fields": {
		        "id": {
		          "columnName": "id",
		          "columnType": "uuid",
		          "name": "id",
		          "nullable": false,
		          "type": "Uuid",
		        },
		        "state": {
		          "columnName": "state",
		          "columnType": "ArticleState",
		          "name": "state",
		          "nullable": true,
		          "type": "Enum",
		        },
		        "title": {
		          "columnName": "title",
		          "columnType": "text",
		          "name": "title",
		          "nullable": false,
		          "type": "String",
		        },
		      },
		      "indexes": {},
		      "name": "Article",
		      "primary": "id",
		      "primaryColumn": "id",
		      "tableName": "article",
		      "unique": {},
		    },
		  },
		  "enums": {
		    "ArticleState": [
		      "PUBLISHED",
		      "DRAFT",
		    ],
		  },
		}
	`)
})

test('unidirectional has-one relation', () => {
	expect(converter.convert(`
	type Category {
		name: String!
	}
	type Article {
		title: String!
		category: Category!
	}
	`)).toMatchInlineSnapshot(`
		{
		  "entities": {
		    "Article": {
		      "eventLog": {
		        "enabled": true,
		      },
		      "fields": {
		        "category": {
		          "joiningColumn": {
		            "columnName": "category_id",
		            "onDelete": "restrict",
		          },
		          "name": "category",
		          "nullable": false,
		          "target": "Category",
		          "type": "ManyHasOne",
		        },
		        "id": {
		          "columnName": "id",
		          "columnType": "uuid",
		          "name": "id",
		          "nullable": false,
		          "type": "Uuid",
		        },
		        "title": {
		          "columnName": "title",
		          "columnType": "text",
		          "name": "title",
		          "nullable": false,
		          "type": "String",
		        },
		      },
		      "indexes": {},
		      "name": "Article",
		      "primary": "id",
		      "primaryColumn": "id",
		      "tableName": "article",
		      "unique": {},
		    },
		    "Category": {
		      "eventLog": {
		        "enabled": true,
		      },
		      "fields": {
		        "id": {
		          "columnName": "id",
		          "columnType": "uuid",
		          "name": "id",
		          "nullable": false,
		          "type": "Uuid",
		        },
		        "name": {
		          "columnName": "name",
		          "columnType": "text",
		          "name": "name",
		          "nullable": false,
		          "type": "String",
		        },
		      },
		      "indexes": {},
		      "name": "Category",
		      "primary": "id",
		      "primaryColumn": "id",
		      "tableName": "category",
		      "unique": {},
		    },
		  },
		  "enums": {},
		}
	`)
})

test('bidirectional many-has-one relation', () => {
	expect(converter.convert(`
	type Category {
		name: String!
		articles: [Article!]!
	}
	type Article {
		title: String!
		category: Category!
	}
	`)).toMatchInlineSnapshot(`
		{
		  "entities": {
		    "Article": {
		      "eventLog": {
		        "enabled": true,
		      },
		      "fields": {
		        "category": {
		          "inversedBy": "articles",
		          "joiningColumn": {
		            "columnName": "category_id",
		            "onDelete": "restrict",
		          },
		          "name": "category",
		          "nullable": false,
		          "target": "Category",
		          "type": "ManyHasOne",
		        },
		        "id": {
		          "columnName": "id",
		          "columnType": "uuid",
		          "name": "id",
		          "nullable": false,
		          "type": "Uuid",
		        },
		        "title": {
		          "columnName": "title",
		          "columnType": "text",
		          "name": "title",
		          "nullable": false,
		          "type": "String",
		        },
		      },
		      "indexes": {},
		      "name": "Article",
		      "primary": "id",
		      "primaryColumn": "id",
		      "tableName": "article",
		      "unique": {},
		    },
		    "Category": {
		      "eventLog": {
		        "enabled": true,
		      },
		      "fields": {
		        "articles": {
		          "name": "articles",
		          "ownedBy": "category",
		          "target": "Article",
		          "type": "OneHasMany",
		        },
		        "id": {
		          "columnName": "id",
		          "columnType": "uuid",
		          "name": "id",
		          "nullable": false,
		          "type": "Uuid",
		        },
		        "name": {
		          "columnName": "name",
		          "columnType": "text",
		          "name": "name",
		          "nullable": false,
		          "type": "String",
		        },
		      },
		      "indexes": {},
		      "name": "Category",
		      "primary": "id",
		      "primaryColumn": "id",
		      "tableName": "category",
		      "unique": {},
		    },
		  },
		  "enums": {},
		}
	`)
})
