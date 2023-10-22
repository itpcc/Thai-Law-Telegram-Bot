import {JSONSchemaType} from 'ajv';
import * as instanceofDef from 'ajv-keywords/dist/definitions/instanceof';

import { ajv, tgSecretToken, authorizationHeaders } from './globals';

export interface TGHeader {
	'x-telegram-bot-api-secret-token': string
};
export const tgHeaderVld: JSONSchemaType<TGHeader> = ajv.compile({
	type: 'object',
	properties: {
		'x-telegram-bot-api-secret-token': {
			const: tgSecretToken
		},
	},
	required: ['x-telegram-bot-api-secret-token'],
	additionalProperties: {
		type: 'string'
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
	type: 'object',
	properties: {
		update_id: { type: 'number' },
		message: {
			type: 'object',
			properties: {
				message_id: { type: 'number' },
				from: {
					type: 'object',
					properties: {
						id: { type: 'number'},
						is_bot: { type: 'boolean'},
						first_name: { type: 'string'},
						username: { type: 'string'},
						language_code: { type: 'string'}
					},
					required: [
						'id',
						'is_bot',
						'first_name',
						'username',
						'language_code',
					],
					additionalProperties: {
						type: 'string'
					}
				},
				chat: {
					type: 'object',
					properties: {
						id: { type: 'number' },
						first_name: { type: 'string' },
						username: { type: 'string' },
						type: { enum: [ 
							'private',
							'group',
							'supergroup',
							'channel',
						] }
					},
					required: [
						'id',
						'first_name',
						'username',
						'type',
					],
					additionalProperties: {
						type: 'string'
					}
				},
				date: { type: 'number' },
				text: { type: 'string' },
			},
			required: [
				'message_id',
				'from',
				'chat',
				'date',
				'text',
			]
		}
	},
	required: ['update_id', 'message'],
	additionalProperties: {
		type: 'string'
	}
});
export interface UploadHeader {
	'authorization': string
};
export const uploadHeaderVld: JSONSchemaType<UploadHeader> = ajv.compile({
	type: 'object',
	properties: {
		authorization: { enum: [ 
			authorizationHeaders['doc-gen'],
		] },
	},
	required: ['authorization'],
	additionalProperties: {
		type: 'string'
	}
});
export interface UploadBody {
	file: Blob,
	request_code: string,
	signing_info: string,
	preview_png: Blob
};

instanceofDef.CONSTRUCTORS.Blob = Blob;

export const uploadBodyVld: JSONSchemaType<UploadBody> = ajv.compile({
	type: 'object',
	properties: {
		file: { instanceof: 'Blob' },
		preview_png: { instanceof: 'Blob' },
		request_code: { type: 'string' },
		signing_info: { type: 'string' },
	},
	required: ['file', 'preview_png', 'request_code'],
	additionalProperties: {
		type: 'string'
	}
});
export interface HandleDekaRes {
	mode: 'number'|'search',
	dekaSerial?: number,
	dekaYear?: number,
	searchWords?: string[],
	searchLaw?: string,
	searchLawNo?: string,
	withLongNote: boolean,
};
export interface LawInfo {
	sys_id: number,
	law_no: string,
	law_text: string,
};
export interface FetchLawRes {
	law_name: string,
	entries: LawInfo[]
};
export interface HandleDocGenRes {
	template: string,
	input_data: {
		[key: string]: string
	},
	request_code: string,
	signature_type: string
};

export interface WSMsgDeka {
	dekaNo: string,
	shortNote: string,
	longNote?: string,
	metadata: {
		law?: string,
		source: string,
	},
}

export interface WSMsg {
	from: string,
	result?: WSMsgDeka[],
	message: TGBody
}