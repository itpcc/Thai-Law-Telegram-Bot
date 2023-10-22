import { Database } from "bun:sqlite";
import { Elysia, t, Context } from "elysia";
import { TGBody, HandleDocGenRes, uploadHeaderVld, uploadBodyVld, UploadBody } from '../types.d';
import { replyTG, replyTGFile } from '../telegram';

export const handleDocGen = async (
	msgInfo: TGBody,
	docDb: Database
): Promise<HandleDocGenRes|null> => {
	const docGenRegexRes = /^สำเนา\s(บัตร)?(ปชช|ทะเบียนบ้าน|ทนาย|idcard|homedb|attoney)\s(\S+)\s(\S+)(\s(today|\d{4}-\d{2}-\d{2}))?(\sม?(9|26|28|plain|cert|solana))?\s*$/gi
		.exec(msgInfo.message.text.replaceAll(" "," "));
	if (! docGenRegexRes || ! docGenRegexRes[2]) return null;
	
	const [, , docType, reason, org, , signDate, , certType ] = docGenRegexRes;
	const tmplName = {
		'ปชช':      'IDCard',
		'idcard':   'IDCard',
		'ทะเบียนบ้าน': 'HomeDB',
		'homedb':   'HomeDB',
		'ทนาย':     'Attoney',
		'attoney':  'Attoney',
	}[docType.toLowerCase()] ?? null;

	if (! tmplName) return null;

	const inputData = {
		reason,
		org,
		date: (
			(signDate ?? 'today').toLowerCase() === 'today' ?
			(new Date()) :
			(new Date(signDate))
		).toLocaleString(
			'th-TH',
			{ year: 'numeric', month: 'long', day: 'numeric' }
		)
	};
	const signatureType = {
		'9'     : 'plain',
		'26'    : 'art26',
		'28'    : 'art28',
		'plain' : 'plain',
		'cert'  : 'art26',
		'solana': 'art28',
	}[(docGenRegexRes[8] ?? 'none').toLowerCase()] ?? null;
	
	// Create doc_requests
	const docQ = docDb
		.query(`
			INSERT INTO doc_requests (
				req_at,
				tmpl_name,
				req_salt,	
				input_data,
				req_from,
				req_meta
			) SELECT
				CURRENT_TIMESTAMP,
				$tmplName,
				$reqSalt,
				$inputData,
				$reqFrom,
				$reqMeta
			RETURNING req_id, req_salt;
		`)
		.get({
			$tmplName: tmplName,
			$reqSalt: (Math.random() + 1).toString(36),
			$inputData: JSON.stringify(inputData),
			$reqFrom: 'telegram',
			$reqMeta: JSON.stringify(msgInfo),
		}) as { req_id: number, req_salt: string }|undefined;
	
	if (! docQ) return null;
	
	const hasher = new Bun.CryptoHasher("sha256");

	hasher.update(`${docQ.req_id}:{docQ.req_salt}`);

	return {
		template:       tmplName,
		input_data:     inputData,
		request_code:   `${docQ.req_id}-${hasher.digest("hex")}`,
		signature_type: signatureType		
	} as HandleDocGenRes;
};

export const onStart = async (docDb: Database) => {
	console.log('doc-gen::onStart | Creating doc_requests table');
	docDb.query(`
		CREATE TABLE IF NOT EXISTS doc_requests (
			req_id			INTEGER		PRIMARY KEY,
			req_at			DATETIME	DEFAULT CURRENT_TIMESTAMP,
			tmpl_name		TEXT		NOT NULL,
			req_salt		TEXT		NOT NULL,
			input_data		TEXT		NOT NULL,
			req_from		TEXT		NOT NULL,
			req_meta		TEXT		NOT NULL,
			gen_at			DATETIME	NULL,
			signing_info	TEXT		NULL,
			preview_png		BLOB		NULL
		)
	`).run();
	console.log('doc-gen::onStart | Created doc_requests table');
}

export const onTelegramMsg = async (
	app: Elysia,
	botToken: string,
	msgInfo: TGBody,
	docDb: Database
): Promise<Boolean> => {
	if (/^สำเนา\s/i.test(msgInfo.message.text)) {
		const docGenRes = await handleDocGen(msgInfo, docDb);
		if (docGenRes !== null) {
			app.server!.publish('doc-gen', JSON.stringify({
				message: msgInfo,
				info: docGenRes
			}));

			return true;
		}

		await replyTG(
			botToken,
			msgInfo.message.from.id,
			msgInfo.message.message_id,
			`__Doc generation format:__\n
			\\- \`สำเนา [ปชช|ทะเบียนบ้าน|ทนาย|idcard|homedb|attoney] เหตุผล หน่วยงาน [today|xxxx-xx-xx] [plain|cert|solana]\`\n
			`
		);

		return true;
	}

	return false;
};

export const routePost = (botToken: string, docDb: Database) => {
	return async (ctx: Context) => {
		if (! uploadHeaderVld(ctx.headers)){
			ctx.set.status = 403;
			return {
				"msg": "Access Denied",
				"err_cde": 4030,
				"error": uploadHeaderVld.errors
			};
		}
		if (! uploadBodyVld(ctx.body)){
			ctx.set.status = 400;
			return {
				"msg": "Body validation error",
				"err_cde": 4000,
				"error": uploadBodyVld.errors
			};
		}

		let body = ctx.body as UploadBody;
		
		let signingInfo;
		
		try {
			signingInfo = JSON.parse(body.signing_info);
		} catch (e) {
			ctx.set.status = 400;
			return {
				"msg": "signing_info malformed",
				"err_cde": 4001,
				"error": e
			};
		}
		
		// fetch doc_requests
		const docQ = docDb
			.query(`
				SELECT req_id, req_salt, req_from, req_meta
				FROM doc_requests
				WHERE req_id = $reqId AND gen_at IS NULL
				LIMIT 1;
			`)
			.get({ $reqId: body.request_code.split('-')[0] }) as {
				req_id: number,
				req_salt: string,
				req_from: string,
				req_meta: string
			} | undefined;
		
		if (! docQ) {
			ctx.set.status = 404;
			return {
				"msg": "Document Not Found",
				"err_cde": 4040,
				"error": null
			};
		}
	
		const hasher = new Bun.CryptoHasher("sha256");

		hasher.update(`${docQ.req_id}:{docQ.req_salt}`);

		if (body.request_code !== `${docQ.req_id}-${hasher.digest("hex")}`) {
			ctx.set.status = 400;
			return {
				"msg": "Request code not match with the hash",
				"err_cde": 4002,
				"error": null
			};
		}
		
		const docUpdParam = {
			$reqId: docQ.req_id,
			$genAt: signingInfo?.sign_at ?? (new Date()).toISOString(),
			$signingInfo: JSON.stringify(signingInfo),
			$previewPng: body.preview_png ?
				new Uint8Array(await body.preview_png.arrayBuffer()) :
				null
		};

		docDb
			.query(`
				UPDATE doc_requests
				SET (gen_at, signing_info, preview_png) =
					($genAt, $signingInfo, $previewPng)
				WHERE req_id = $reqId;
			`).run(docUpdParam);

		const reqMeta = JSON.parse(docQ.req_meta);
		console.log('doc-gen::routePost | docQ.req_from', docQ.req_from, reqMeta);
		
		if (docQ.req_from === 'telegram') {
			const tgRes = await replyTGFile(
				botToken,
				reqMeta.message.from.id,
				reqMeta.message.message_id,
				body.file,
				`doc-${docQ.req_id}.pdf`
			);
			console.log('doc-gen::routePost | tgRes', tgRes);
		}

		return { ok: true };
	};
};

export const routePostValidator = {
	type: 'formdata',
	body: t.Object({
		file: t.File(),
		request_code: t.String(),
		signing_info: t.Optional(t.String()),
		preview_png: t.File()
	})
};
