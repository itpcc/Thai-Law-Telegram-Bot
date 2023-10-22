import { TGBody, HandleDekaRes, WSMsg } from '../types.d';
import { lawAbbrToFull } from './law';
import { replyTG, escapeMD2 } from '../telegram';
import { Elysia } from 'elysia';

export const handleDeka = (msgInfo: TGBody): HandleDekaRes|null => {
	const dekaNoRegexRes = /^ฎีกา\s(\d+)\/(\d+)(\s(ย่อ)?(สั้น|ยาว))?\s?$/g
		.exec(msgInfo.message.text);
	if (dekaNoRegexRes !== null) {
		// Search Deka by number
		return {
			mode: 'number',
			dekaSerial: Number(dekaNoRegexRes[1]),
			dekaYear: Number(dekaNoRegexRes[2]),
			withLongNote: dekaNoRegexRes[5] === 'ยาว'
		}
	}

	const dekaSearchRegexRes = /^ฎีกา\s(\S{3,})\s?((\S{3,})\s(\S+))?(\s(ย่อ)?(สั้น|ยาว))?\s?$/g
		.exec(msgInfo.message.text);
	if (dekaSearchRegexRes !== null) {
		// Search Deka by number
		return {
			mode: 'search',
			searchWords: dekaSearchRegexRes[1].split(','),
			searchLaw: lawAbbrToFull(dekaSearchRegexRes[3], true),
			searchLawNo: dekaSearchRegexRes[4],
			withLongNote: dekaSearchRegexRes[7] === 'ยาว'
		}
	}
	
	return null;
};

export const onWSMsg = async (botToken: string, msg: WSMsg) => {
	if (msg.result && msg?.result?.length > 0) {
		for (const deka of msg.result) {
			const rplyMsg = `
				__ฎีกา\\(${escapeMD2(deka.dekaNo)}\\):__
				
				${escapeMD2(deka.shortNote)}
				${deka?.longNote ? escapeMD2('-------------') : ''}
				${deka?.longNote ?? ''}
				${escapeMD2('-------------')}
				_กฎหมาย_: ${escapeMD2(deka.metadata.law ?? '--ไม่ระบุ--')}
				_ที่มา_: ${escapeMD2(deka.metadata.source)}
			`.split("\n").map(s => s.trim()).join('\n');
			const rplyRes = await replyTG(
				botToken,
				msg.message.message.from.id,
				msg.message.message.message_id,
				rplyMsg
			);
			rplyRes?.forEach((res) => {
				if (! res?.ok) console.log('rplyRes', res);
			});
		}

		return;
	}

	await replyTG(
		botToken,
		msg.message.message.from.id,
		msg.message.message.message_id,
		escapeMD2('ไม่พบฎีกาที่ท่านค้นหา')
	);
};

export const onTelegramMsg = async (
	app: Elysia,
	botToken: string,
	msgInfo: TGBody
): Promise<Boolean> => {
	if (/^ฎีกา\s/i.test(msgInfo.message.text)) {
		const dekaRes = handleDeka(msgInfo);

		if (dekaRes !== null) {
			// Search Deka by number
			app.server!.publish('deka', JSON.stringify({
				message: msgInfo,
				info: dekaRes
			}));

			return true;
		}

		await replyTG(
			botToken,
			msgInfo.message.from.id,
			msgInfo.message.message_id,
			`__Search Deka format:__\n
			\\- \`ฎีกา xxxx/xxxx [ย่อสั้น|ย่อยาว]\`\n
			\\- \`ฎีกา คำ,สำคัญ [ย่อสั้น|ย่อยาว]\`\n
			\\- \`ฎีกา คำ,สำคัญ ชื่อกฎหมาย(ป.อ.|ป.พ.พ.|พ.ร.บ.xxxx) xxมาตราxx [ย่อสั้น|ย่อยาว]\`\n
			`
		);

		return true;
	}

	return false;
};
