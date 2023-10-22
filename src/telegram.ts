export const replyTGReal = async (
	botToken: string,
	chat_id: Number,
	reply_to_message_id: Number,
	text: string
) => {
	const tgRes = await fetch(
		`https://api.telegram.org/bot${botToken}/sendMessage`, {
			method: 'POST',
			body: JSON.stringify({
				chat_id,
				reply_to_message_id,
				text,
				parse_mode: 'MarkdownV2'
			}),
			headers: new Headers({
				'Content-Type': 'application/json'
			})
		}
	);
	return await tgRes.json();
};

export const replyTG = async (
	botToken: string,
	chat_id: Number,
	reply_to_message_id: Number,
	text: string
) => {
	let txtChunk = '';
	let tgResAll = [];
	for (const txtLn of text.split('\n')) {
		if (txtChunk.length + txtLn.length > 4000) {
			const tgRes = await replyTGReal(
				botToken,
				chat_id,
				reply_to_message_id,
				txtChunk
			);
			tgResAll.push(tgRes);
			txtChunk = '';
		}
		txtChunk += txtLn;
		txtChunk += '\n';
	}
	
	if (txtChunk.length > 0) {
		tgResAll.push(await replyTGReal(
			botToken,
			chat_id,
			reply_to_message_id,
			txtChunk
		));
	}
	
	return tgResAll;
};

export const escapeMD2 = (txt: string): string => {
	return (txt ?? '')
	  .replace(/\_/g, '\\_')
	  .replace(/\*/g, '\\*')
	  .replace(/\[/g, '\\[')
	  .replace(/\]/g, '\\]')
	  .replace(/\(/g, '\\(')
	  .replace(/\)/g, '\\)')
	  .replace(/\~/g, '\\~')
	  .replace(/\`/g, '\\`')
	  .replace(/\>/g, '\\>')
	  .replace(/\#/g, '\\#')
	  .replace(/\+/g, '\\+')
	  .replace(/\-/g, '\\-')
	  .replace(/\=/g, '\\=')
	  .replace(/\|/g, '\\|')
	  .replace(/\{/g, '\\{')
	  .replace(/\}/g, '\\}')
	  .replace(/\./g, '\\.')
	  .replace(/\!/g, '\\!')
	;
};

export const replyTGFile = async (
	botToken: string,
	chat_id: Number,
	reply_to_message_id: Number,
	file: Blob,
	filename: string
) => {
	const formData = new FormData();

	formData.append('chat_id', chat_id.toString());
	formData.append('reply_to_message_id', reply_to_message_id.toString());
	formData.append('document', file, filename);
	formData.append('caption', filename);

	const tgRes = await fetch(
		`https://api.telegram.org/bot${botToken}/sendDocument`, {
			method: 'POST',
			body: formData /*,
			headers: new Headers({
				'Content-Type': 'multipart/form-data'
			}) */
		}
	);
	return await tgRes.json();
};

export const onStart = async (botToken: string, botSecretToken: string, botHost: string) => {
	console.log('Start | Registering Telegram Webhook');
	
	const tgRes = await fetch(
		`https://api.telegram.org/bot${botToken}/setWebhook`, {
			method: 'POST',
			body: JSON.stringify({
				url: `${botHost}/telegram`,
				secret_token: botSecretToken,
				allowed_updates: []
			}),
			headers: new Headers({
				'Content-Type': 'application/json'
			})
		}
	);
	const tgResBody = await tgRes.json();
	console.log('Start | Registered Telegram Webhook', tgResBody);

	const tgCfRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
	console.log('Start | Confirmed Telegram Webhook', await tgCfRes.json());
};
