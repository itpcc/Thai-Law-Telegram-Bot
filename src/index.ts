import { Elysia, t } from "elysia";
import Ajv, {JSONSchemaType} from "ajv";
import AjvKeyword from "ajv-keywords";
import { convert } from "html-to-text";
import { Database } from "bun:sqlite";
import { decode } from 'windows-874';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import 'dotenv/config';

// Project modules
import { replyTG, escapeMD2 } from './telegram';
import { TGHeader, tgHeaderVld, TGBody, tgBodyVld, LawInfo, FetchLawRes } from './typedef';
import { lawAbbrToFull, handleLaw } from './handler';

// * Global vars
const lawDb = new Database("./resources/law_info.sqlite");
const ajv = new Ajv({allErrors: true});
AjvKeyword(ajv);
const tgSecretToken = (Math.random() + 1).toString(36).substring(2);

const app = new Elysia({
	websocket: {
        idleTimeout: 30
    }
})
	.on('start', async () => {
		console.log('Start | Registering Telegram Webhook');
		
		const tgRes = await fetch(
			`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/setWebhook`, {
				method: 'POST',
				body: JSON.stringify({
					url: `${process.env.TG_WEBHOOK_HOST}/telegram`,
					secret_token: tgSecretToken,
					allowed_updates: []
				}),
				headers: new Headers({
					'Content-Type': 'application/json'
				})
			}
		);
		const tgResBody = await tgRes.json();
		console.log('Start | Registered Telegram Webhook', tgResBody);

		const tgCfRes = await fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/getWebhookInfo`);
		console.log('Start | Confirmed Telegram Webhook', await tgCfRes.json());
	})
	.get("/", () => "Hello Elysia")
	.post("/telegram", async (ctx) => {
		if (! tgHeaderVld(ctx.headers)){
			ctx.set.status = 403;
			return {
				"error": "Access Denied",
				"err_cde": 4030,
				"error": tgHeaderVld.errors
			};
		}

		if (! tgBodyVld(ctx.body)){
			ctx.set.status = 400;
			return {
				"error": "Body validation error",
				"err_cde": 4000,
				"error": tgBodyVld.errors
			};
		}
		
		console.log('Telegram | ', {
			from: ctx.body?.message?.from?.id,
			text: ctx.body?.message?.text
		});

		if (/^กม\s/i.test(ctx.body.message.text)) {
			const lawRes = await handleLaw(ctx.body, lawDb);

			if (lawRes !== null) {
				const lawRplyTxt = lawRes['entries'].length > 0
					? (`__${escapeMD2(lawRes['law_name'])}:__\n` + lawRes['entries'].map(entry => {
						return `\\- *มาตรา ${escapeMD2(entry.law_no)}* ${escapeMD2(entry.law_text)}`;
					}).join('\n'))
					: `__${escapeMD2(lawRes['law_name'])}:__\nไม่พบมาตราที่ค้นหา`;
				const lawRplyRes = await replyTG(
					ctx.body.message.from.id,
					ctx.body.message.message_id,
					lawRplyTxt
				);
			} else {
				await replyTG(
					process.env.TG_BOT_TOKEN,
					ctx.body.message.from.id,
					ctx.body.message.message_id,
					`__Search Law format:__\n
					\\- \`กม ชื่อกฎหมาย(ป.อ.|ป.พ.พ.|พ.ร.บ.xxxx) xxเลขมาตรา(ถ้ามีเลขบาลีให้เขียนติดกันกับเลขมาตราหลัก)xx\`\n
					\\- \`กม ชื่อกฎหมาย(ป.อ.|ป.พ.พ.|พ.ร.บ.xxxx) คำ,สำคัญ\`\n
					`
				);
			}
		}

		return { ok: true };
	})
	.listen(process.env.PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
