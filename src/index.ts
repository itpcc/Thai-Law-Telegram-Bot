import { Elysia } from "elysia";
import 'dotenv/config';

// * Project modules
import { onStart as TGOnStart } from './telegram';
import { tgHeaderVld, tgBodyVld, TGBody, WSMsg } from './types.d';
import {
	onWSMsg as DekaOnWSMSG,
	onTelegramMsg as DekaOnTelegramMsg
} from "./handlers/deka";
import { onTelegramMsg as LawOnTelegramMsg } from './handlers/law';
import {
	onStart as DocGenOnStart,
	onTelegramMsg as DocGenOnTelegramMsg,
	routePost as DocGenRoutePost,
	routePostValidator as DocGenRoutePostValidator,
} from './handlers/doc-gen';

// * Global vars
import {
	tgBotToken,
	tgSecretToken,
	tgWebhookHost,
	lawDb,
	docDb,
	authorizationHeaders,
} from './globals';

const app = new Elysia({
	websocket: {
        idleTimeout: 30
    }
})
	.on('start', async () => {
		await Promise.all([
			TGOnStart(tgBotToken, tgSecretToken, tgWebhookHost),
			DocGenOnStart(docDb),
		]);		
	})
	.get("/", () => "Hello Elysia")
    .ws('/ws', {
		open(ws) {
			for (const topic in authorizationHeaders) if (
				ws.data?.headers?.authorization?.toLowerCase() ===
					authorizationHeaders[topic].toLowerCase()
			) {
				ws.subscribe(topic);
			}
		},
        async message(ws, msg) {
            console.log('ws | message', msg);

			const payload = msg as WSMsg;

			if (payload.from === 'deka') {
				await DekaOnWSMSG(tgBotToken, msg as WSMsg);
			}
        }
    })
	.post("/telegram", async (ctx) => {
		if (! tgHeaderVld(ctx.headers)){
			ctx.set.status = 403;
			return {
				"msg": "Access Denied",
				"err_cde": 4030,
				"error": tgHeaderVld.errors
			};
		}

		if (! tgBodyVld(ctx.body)){
			ctx.set.status = 400;
			return {
				"msg": "Body validation error",
				"err_cde": 4000,
				"error": tgBodyVld.errors
			};
		}

		const body = ctx.body as TGBody;

		const moduleResList = await Promise.all([
			DekaOnTelegramMsg(app, tgBotToken, body),
			LawOnTelegramMsg(tgBotToken, body, lawDb),
			DocGenOnTelegramMsg(app, tgBotToken, body, docDb)
		]) as Boolean[];

		return { ok: moduleResList.indexOf(true) !== -1 };
	})
	.post("/doc-gen", DocGenRoutePost(tgBotToken, docDb), DocGenRoutePostValidator)
	.listen(Number(process.env.PORT ?? '8080'));

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
