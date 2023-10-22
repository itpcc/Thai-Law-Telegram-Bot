import { Database } from "bun:sqlite";
import Ajv from "ajv";
import AjvKeyword from "ajv-keywords";
import 'dotenv/config';

export const tgBotToken = process.env.TG_BOT_TOKEN as string;
export const tgWebhookHost = process.env.TG_WEBHOOK_HOST as string;
export const tgSecretToken = (Math.random() + 1).toString(36).substring(2);
export const lawDb = new Database("./resources/law_info.sqlite");
export const docDb = new Database("./resources/doc_info.sqlite", { create: true });
export const ajv = new Ajv({allErrors: true});
AjvKeyword(ajv);

export const authorizationHeaders = {
	'deka': `Bearer ${process.env.CHATBOT_TOKEN_DEKA}`,
	'doc-gen': `Bearer ${process.env.CHATBOT_TOKEN_DOCGEN}`,
} as {
	[key: string]: string
};
