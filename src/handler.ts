import { Database } from "bun:sqlite";
import { TGBody, tgBodyVld, LawInfo, FetchLawRes } from './typedef';

export const lawAbbrToFull = (lawName: string, isDeka: boolean): string => {
	const lawNameNoSpace = lawName.replace(/[\u200B-\u200D\uFEFF]/g, '');
	const PRBAbbr = (dotList) => {
		return [ 'พรบ', 'พรบ.', 'พ.ร.บ.' ].reduce((arrList, prb) => {
			arrList.push(prb + dotList.join(''));
			arrList.push(prb + dotList.join('.'));
			return arrList;
		}, [])
	}
	for (const lawInfo of Object.entries({
		"ประมวลกฎหมายแพ่งและพาณิชย์": [ 'แพ่ง', 'ปพพ', 'ปพพ.', 'ป.พ.พ.' ],
		"ประมวลกฎหมายอาญา": [ 'อาญา', 'ปอ', 'ปอ.', 'ป.อ.' ],
		"ประมวลกฎหมายวิธีพิจารณาความแพ่ง": [ 'วิแพ่ง', 'ปวิแพ่ง', 'ป.วิ.พ', 'ป.วิ.แพ่ง', 'ปวิพ', 'ปวิพ.' ],
		"ประมวลกฎหมายวิธีพิจารณาความอาญา": [ 'วิอาญา', 'ปวิอ', 'ปวิอาญา', 'ป.วิ.อ', 'ป.วิ.อ.', 'ป.วิ.อาญา', 'ปวิอ.'],
		"ประมวลกฎหมายที่ดิน": [ 'วิที่ดิน', 'ปวิดิน', 'ปวิที่ดิน', 'ปวิดิน', 'ป.วิ.ที่ดิน', 'ป.วิ.ดิน' ],
		"ประมวลรัษฎากร": [ 'รัษฎากร', 'ป.ภาษี', 'ปภาษี', 'ป.ร.', 'ปร', 'ปร.' ],
		"ประมวลกฎหมายยาเสพติด": [ 'ยาเสพติด', 'ป.ยาเสพติด', 'ปยา', 'ป.ย.', 'ปย', 'ปย.' ],
		"พระราชบัญญัติศาลเยาวชนและครอบครัวและวิธีพิจารณาคดีเยาวชนและครอบครัว พ.ศ. 2553": [
			...PRBAbbr(['ศาลเด็ก']),
			...PRBAbbr(['วิ', 'เด็ก']),
			'พ.ร.บ.ศาลเยาวชนและครอบครัวและวิธีพิจารณาคดีเยาวชนและครอบครัว'
		],
		"พระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ พ.ศ. 2550": [
			...PRBAbbr(['คอม']),
			...PRBAbbr(['คอมพิวเตอร์']),
		],
		"พระราชบัญญัติวิธีพิจารณาคดีผู้บริโภค พ.ศ. 2551": [
			'วิ.ผ.บ.', 'วิ.ผบ.', 'วิผบ.', 'วิผบ',
			'วิ.ผู้บริโภค.', 'วิ.ผู้บริโภค', 'วิผู้บริโภค.', 'วิผู้บริโภค',
			...PRBAbbr(['วิ', 'ผบ']),
			...PRBAbbr(['วิ', 'ผ', 'บ']),
			...PRBAbbr(['วิ', 'ผู้บริโภค']),
		]
	})) {
		if (lawNameNoSpace === lawInfo[0] || lawInfo[1].indexOf(lawNameNoSpace) !== -1) {
			return isDeka ? lawInfo[0].replace('พระราชบัญญัติ', 'พ.ร.บ.') : lawInfo[0];
		}
	}

	return lawNameNoSpace;
}

const handleLaw = async (msgInfo: TGBody, lawDb: Database): Promise<FetchLawRes|null> => {
	const lawRegexRes = /^กม\s(\S+)\s(([0-9]+\S*)|(\S+))$/g.exec(msgInfo.message.text);
	if (! lawRegexRes || ! lawRegexRes[1]) return null;
	
	const lawName = lawRegexRes[1];
	const lawNo = lawRegexRes[3];
	const lawKeyword = lawRegexRes[4];

	if (! lawNo && ! lawKeyword) return null;

	// Find law sys_id
	const lawNameQ = lawDb
		.query("SELECT CAST(sysid AS INT) AS sys_id, item_name FROM law_url WHERE item_name LIKE $lawName || ' %' AND item_name LIKE '% (ฉบับ Update ล่าสุด)';")
		.get({ $lawName: lawAbbrToFull(lawName, false) }) as { sys_id: number, item_name: string }|undefined;
	
	if (! lawNameQ) return null;

	// Check whether we need to fetch from Krisdika first?
	const lawCahceQ = lawDb
		.query("SELECT 1 FROM law_fetch_info WHERE sys_id = $sysId AND fetch_at >= (CURRENT_TIMESTAMP - '3 months');")
		.get({ $sysId: lawNameQ['sys_id'] }) as { fetch_at: Date }|undefined;
	
	if (! lawCahceQ) {
		// Fetch from Krisdika
		const ksdkFetch = await fetch(
			`https://www.krisdika.go.th/librarian/getfile?sysid=${lawNameQ['sys_id']}&ext=htm`
		);		
		if (ksdkFetch.status !== 200) return null;

		/*
		const ksdkHtml = await ksdkFetch.blob();
		const decoder = new TextDecoder('windows-874');
		const ksdkHtmlDecode = decoder.decode(ksdkHtml);
		*/
		// ! Temporary measure for Decoding
		const tmpDir = await mkdtemp(join(tmpdir(), 'enc-'));
		const lawFile = join(tmpDir, "law.html");
		await Bun.write(lawFile, ksdkFetch);
		const proc = Bun.spawn(["iconv", "-f", "windows-874", "-t", "UTF-8", lawFile]);
		const ksdkHtml = await new Response(proc.stdout).text();
		await rm(lawFile);
		// ! Temporary measure for Decoding END
		const ksdkTxt = convert(ksdkHtml, {
			wordwrap: false,
			preserveNewlines: true,
		}).replaceAll(" "," ");

		const lawLst: LawInfo[] = [];

		let curLawEntry = '';
		let curLawNo = '';
		for (const txtLine of ksdkTxt.split('\n')) {
			const txtTrim = txtLine.trim();
			if (txtTrim === '') continue;
			if (txtTrim.indexOf('พระราชบัญญัติแก้ไข') === 0) break;

			if (/^มาตรา [๐-๙0-9\/]+/g.test(txtTrim)) {
				if (curLawNo.length > 0) {
					lawLst.push({
						sys_id: lawNameQ['sys_id'],
						law_no: curLawNo,
						law_text: curLawEntry
					});
				}

				const lawRegexRes = /^มาตรา ([๐-๙0-9\/]+)(\s(\S+)\[[๐-๙0-9]+\])?\s*(.*)$/g.exec(txtTrim);

				if (lawRegexRes) {
					curLawNo = [ ...lawRegexRes[1] ].reduce((lawNo, chr) => {
						return lawNo + (Object
							.entries({"1":"๑", "2":"๒", "3":"๓", "4" : "๔", "5" : "๕", "6" : "๖", "7" : "๗", "8" : "๘", "9" : "๙", "0" : "๐"})
							.reduce((curNo, numInfo) => {
								if (chr === numInfo[1]) return numInfo[0];
								return curNo;
							}, '') || chr);
					}, '');

					// Phali-style extension article
					if (lawRegexRes[3]) {
						curLawNo += `${lawRegexRes[3]}`
					}

					curLawEntry = lawRegexRes[4] ?? '';
				}
			} else { 
				curLawEntry += `\n${txtTrim}`;
			}
		}

		if (curLawNo) {
			// Record the last one 
			lawLst.push({
				sys_id: lawNameQ['sys_id'],
				law_no: curLawNo,
				law_text: curLawEntry
			});
		}

		if (lawLst.length > 0) {
			const insertLawQ = lawDb.prepare(`
				INSERT INTO law_data (sys_id, law_no, law_text) 
				SELECT ?1, ?2, ?3
				WHERE NOT EXISTS (
					SELECT 1 FROM law_data
					WHERE (sys_id, law_no) = (?1, ?2)
				)
			`);
			lawDb.transaction((laws: LawInfo[]) => {
				for (const law of laws) insertLawQ.run(
					law.sys_id,
					law.law_no,
					law.law_text,
				);
				lawDb.query(
					"INSERT INTO law_fetch_info (sys_id, fetch_at) VALUES (?1, CURRENT_TIMESTAMP)"
				).run(lawNameQ['sys_id']);
			})(lawLst);
		}
	}

	let lawQCond = '';
	let lawQArg = {
		$sysId: lawNameQ['sys_id']
	} as {
		[key: string]: string
	};
	if (lawNo) {
		lawQCond += " AND law_no = $lawNo";
		lawQArg['$lawNo'] = `${lawNo}`;
	}
	if (lawKeyword?.length > 0) {
		lawQCond += ' AND (';
		lawQCond += lawKeyword.trim().split(',').map((lk, idx) => {
			const kwdIdx = `$lawKeyword${idx}`;
			lawQArg[kwdIdx] = lk;

			return `law_text LIKE '%' || ${kwdIdx} || '%'`;
		}).join(' AND ');
		lawQCond += ')';
	}

	const lawQ = lawDb
		.query(`SELECT * FROM law_data WHERE sys_id = $sysId ${lawQCond}`)
		.all(lawQArg) as LawInfo[]|undefined;
	
	if (lawQ) return {
		law_name: lawNameQ['item_name'],
		entries: lawQ
	};

	return null;
}
