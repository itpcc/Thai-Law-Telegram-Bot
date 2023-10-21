export const replyTGReal = async (botToken: string, chat_id: Number, reply_to_message_id: Number, text: String) => {
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

export const replyTG = async (botToken: string, chat_id: Number, reply_to_message_id: Number, text: String) => {
	let txtChunk = '';
	let tgResAll = [];
	for (const txtLn of text.split('\n')) {
		if (txtChunk.length + txtLn.length > 4000) {
			const tgRes = await replyTGReal(chat_id, reply_to_message_id, txtChunk);
			tgResAll.push(tgRes);
			txtChunk = '';
		}
		txtChunk += txtLn;
		txtChunk += '\n';
	}
	
	if (txtChunk.length > 0) {
		tgResAll.push(await replyTGReal(chat_id, reply_to_message_id, txtChunk));
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
}
