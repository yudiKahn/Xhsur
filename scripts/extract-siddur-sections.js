const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'src', 'assets', 'siddur', 'weekday-siddur-chabad-he-merged.html');
const targetDir = path.join(__dirname, '..', 'src', 'assets', 'siddur', 'sections');

const ranges = [
  { id: 'birkot-hashachar', start: 4, end: 42 },
  { id: 'korbanot', start: 44, end: 123 },
  { id: 'hodu', start: 125, end: 151 },
  { id: 'yishtabach', start: 153, end: 500 },
  { id: 'tefilat-haderech', start: 502, end: 505 },
  { id: 'birkat-hamazon', start: 546, end: 636 },
  { id: 'ashrei', start: 637, end: 849 },
  { id: 'maariv-main', start: 850, end: 1227 },
  { id: 'kriat-shema-al-hamita', start: 1228, end: 1276 },
];

const sourceLines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);

fs.mkdirSync(targetDir, { recursive: true });

for (const range of ranges) {
  const lines = sourceLines.slice(range.start - 1, range.end);
  const html = postProcessSection(range.id, normalizeSection(lines));
  fs.writeFileSync(path.join(targetDir, `${range.id}.html`), `${html}\n`, 'utf8');
}

function normalizeSection(lines) {
  const chunks = [];
  let buffer = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^--.*--$/.test(line)) {
      continue;
    }

    buffer.push(line);

    if (/<\/h[16]>$/.test(line)) {
      chunks.push(buffer.join(' '));
      buffer = [];
    }
  }

  if (buffer.length) {
    chunks.push(buffer.join(' '));
  }

  return chunks
    .flatMap((chunk) => normalizeChunk(chunk))
    .filter(Boolean)
    .join('\n');
}

function normalizeChunk(chunk) {
  const compact = chunk.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return [];
  }

  const cleaned = compact
    .replace(/<h[16][^>]*>/g, '')
    .replace(/<\/h[16]>/g, '')
    .trim();

  if (!cleaned) {
    return [];
  }

  const smallMatch = cleaned.match(/<small>(.*?)<\/small>/i);
  if (smallMatch) {
    const smallText = stripTags(smallMatch[1]);
    const mainText = stripTags(cleaned.replace(/<small>.*?<\/small>/i, ''));
    return [
      wrap('h6', smallText),
      wrap('h1', mainText),
    ].filter(Boolean);
  }

  return [wrap('h1', stripTags(cleaned))].filter(Boolean);
}

function stripTags(value) {
  return value
    .replace(/\u05AF/g, '')
    .replace(/<\/?b>/gi, '')
    .replace(/<\/?strong>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrap(tag, text) {
  return text ? `<${tag}>${text}</${tag}>` : '';
}

function postProcessSection(id, html) {
  if (id !== 'korbanot') {
    return html;
  }

  let lines = html.split('\n');
  lines = mergeKorbanotBlock(
    lines,
    (line) => line.startsWith('<h1>תָּנוּ רַבָּנָן'),
    (line) => line.startsWith('<h1>רַבָּן שִׁמְעוֹן'),
  );
  lines = mergeKorbanotBlock(
    lines,
    (line) => line === '<h1>יְיָ צְבָאוֹת עִמָּנוּ, מִשְׂגָּב־לָנוּ אֱלֹהֵי יַעֲקֹב סֶלָה</h1>',
    (line) => line === '<h1>וְעָרְבָה לַיָי מִנְחַת יְהוּדָה וִירוּשָׁלָיִם, כִּימֵי עוֹלָם וּכְשָׁנִים קַדְמֹנִיּוֹת:</h1>',
  );
  lines = mergeKorbanotBlock(
    lines,
    (line) => line === '<h1>אָנָּא, בְּכֹחַ גְּדֻלַּת יְמִינְךָ, תַּתִּיר צְרוּרָה.</h1>',
    (line) => line === '<h6>ביום שאין אומרים תחנון אין אומרים זה:</h6>',
  );
  lines = mergeKorbanotBlock(
    lines,
    (line) => line === '<h6>א</h6>',
    (line) => line === '<h1>רַבִּי יִשְׁמָעֵאל אוֹמֵר, בִּשְׁלשׁ עֶשְׂרֵה מִדּוֹת הַתּוֹרָה נִדְרֶשֶׁת:</h1>',
  );
  lines = mergeKorbanotBlock(
    lines,
    (line) => line === '<h1>רַבִּי יִשְׁמָעֵאל אוֹמֵר, בִּשְׁלשׁ עֶשְׂרֵה מִדּוֹת הַתּוֹרָה נִדְרֶשֶׁת:</h1>',
    (line) => line === '<h1>יְהִי רָצוֹן מִלְּפָנֶיךָ, יְיָ אֱלֹהֵינוּ וֵאלֹהֵי אֲבוֹתֵינוּ, שֶׁיִּבָּנֶה בֵּית הַמִּקְדָּשׁ בִּמְהֵרָה בְיָמֵינוּ, וְתֵן חֶלְקֵנוּ בְּתוֹרָתֶךָ: קדיש דרבנן</h1>',
  );
  return lines.join('\n');
}

function mergeKorbanotBlock(lines, startMatcher, endMatcher) {
  const start = lines.findIndex(startMatcher);
  const end = lines.findIndex((line, index) => index > start && endMatcher(line));

  if (start === -1 || end === -1) {
    return lines;
  }

  const mergedContent = lines
    .slice(start, end)
    .join(' ')
    .replace(/<h6>(.*?)<\/h6>/g, '<small>$1</small>')
    .replace(/<\/?h1>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [
    ...lines.slice(0, start),
    `<h1>${mergedContent}</h1>`,
    ...lines.slice(end),
  ];
}
