export interface TGHeader {
  "x-telegram-bot-api-secret-token": string
};
export const tgHeaderVld: JSONSchemaType<TGHeader> = ajv.compile({
	type: "object",
	properties: {
		"x-telegram-bot-api-secret-token": {
			"const": tgSecretToken
		},
	},
	required: ["x-telegram-bot-api-secret-token"],
	additionalProperties: {
		type: "string"
	}
});
export interface TGBody {
	update_id: number,
	message: {
		message_id: number,
		from: {
			id: number,
			is_bot: boolean,
			first_name: string,
			username: string,
			language_code: string
		},
		chat: {
			id: number,
			first_name: string,
			username: string,
			type: string
		},
		date: number,
		text: string,
	}
};
export const tgBodyVld: JSONSchemaType<TGBody> = ajv.compile({
	type: "object",
	properties: {
		update_id: { type: "number" },
		message: {
			type: "object",
			properties: {
				message_id: { type: "number" },
				from: {
					type: "object",
					properties: {
						id: { type: "number"},
						is_bot: { type: "boolean"},
						first_name: { type: "string"},
						username: { type: "string"},
						language_code: { type: "string"}
					},
					required: [
						"id",
						"is_bot",
						"first_name",
						"username",
						"language_code",
					],
					additionalProperties: {
						type: "string"
					}
				},
				chat: {
					type: "object",
					properties: {
						id: { type: "number" },
						first_name: { type: "string" },
						username: { type: "string" },
						type: { enum: [ 
							"private",
							"group",
							"supergroup",
							"channel",
						 ] }
					},
					required: [
						"id",
						"first_name",
						"username",
						"type",
					],
					additionalProperties: {
						type: "string"
					}
				},
				date: { type: "number" },
				text: { type: "string" },
			},
			required: [
				"message_id",
				"from",
				"chat",
				"date",
				"text",
			]
		}
	},
	required: ["update_id", "message"],
	additionalProperties: {
		type: "string"
	}
});
export interface LawInfo {
	sys_id: number,
	law_no: string,
	law_text: string,
};
export interface FetchLawRes {
	law_name: string,
	entries: LawInfo[]
};