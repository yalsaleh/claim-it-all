import { createHash } from 'node:crypto';
import { NOTICE_TEMPLATE_VERSION } from './types';
import type { AssembledSection } from './types';
import { renderPlainText } from './drafting';

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export type ExportManifest = {
  format: 'json_manifest';
  noticePackageId: string;
  draftRevisionId: string;
  revisionNumber: number;
  language: string;
  secondaryLanguage: string | null;
  governingLanguage: string;
  translationStatus: string;
  templateVersion: string;
  generatorVersion: string;
  generatedAt: string;
  approvedAt: string | null;
  checksumSha256: string;
  attachments: Array<{
    id: string;
    filename: string;
    checksumSha256: string | null;
    sequence: number;
  }>;
  recipientPreparationIds: string[];
  approvalDecisionId: string | null;
  excludesInternalComments: true;
  excludesProviderMetadata: true;
  deliveryAuthorized: false;
};

export function buildExportManifest(input: {
  noticePackageId: string;
  draftRevisionId: string;
  revisionNumber: number;
  language: string;
  secondaryLanguage?: string | null;
  governingLanguage?: string;
  translationStatus?: string;
  templateVersion?: string;
  generatorVersion: string;
  approvedAt?: string | null;
  plainTextBody: string;
  attachments: Array<{
    id: string;
    filename: string;
    checksumSha256: string | null;
    sequence: number;
  }>;
  recipientPreparationIds: string[];
  approvalDecisionId?: string | null;
}): ExportManifest {
  const generatedAt = new Date().toISOString();
  const checksumSha256 = sha256Hex(input.plainTextBody);
  return {
    format: 'json_manifest',
    noticePackageId: input.noticePackageId,
    draftRevisionId: input.draftRevisionId,
    revisionNumber: input.revisionNumber,
    language: input.language,
    secondaryLanguage: input.secondaryLanguage ?? null,
    governingLanguage: input.governingLanguage ?? input.language,
    translationStatus: input.translationStatus ?? 'SOURCE',
    templateVersion: input.templateVersion ?? NOTICE_TEMPLATE_VERSION,
    generatorVersion: input.generatorVersion,
    generatedAt,
    approvedAt: input.approvedAt ?? null,
    checksumSha256,
    attachments: input.attachments,
    recipientPreparationIds: input.recipientPreparationIds,
    approvalDecisionId: input.approvalDecisionId ?? null,
    excludesInternalComments: true,
    excludesProviderMetadata: true,
    deliveryAuthorized: false,
  };
}

/** Minimal single-page PDF with Helvetica text (no external dependency). */
export function buildSimplePdf(title: string, body: string): Buffer {
  const safe = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
  const lines = `${title}\n\n${body}`.split('\n').slice(0, 40);
  const contentLines = lines
    .map((line, i) => `BT /F1 11 Tf 50 ${750 - i * 14} Td (${safe(line.slice(0, 90))}) Tj ET`)
    .join('\n');
  const stream = contentLines;
  const objs: string[] = [];
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objs.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n',
  );
  objs.push(
    `4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj\n`,
  );
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objs) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

/** Minimal DOCX (OOXML) via store-only ZIP. */
export function buildSimpleDocx(title: string, body: string): Buffer {
  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paragraphs = `${title}\n${body}`
    .split('\n')
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`)
    .join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}<w:sectPr/></w:body>
</w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  return zipStore([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') },
  ]);
}

export function buildAttachmentZip(files: Array<{ filename: string; content: Buffer }>): Buffer {
  for (const f of files) {
    if (f.filename.includes('..') || f.filename.startsWith('/') || f.filename.includes('\\')) {
      throw new Error('PATH_TRAVERSAL_REJECTED');
    }
  }
  return zipStore(files.map((f) => ({ name: f.filename, data: f.content })));
}

export function exportApprovedNotice(input: {
  title: string;
  sections: AssembledSection[];
  noticePackageId: string;
  draftRevisionId: string;
  revisionNumber: number;
  language: string;
  generatorVersion: string;
  attachments?: Array<{
    id: string;
    filename: string;
    content: Buffer;
    checksumSha256: string | null;
    sequence: number;
  }>;
  recipientPreparationIds?: string[];
  approvalDecisionId?: string | null;
  approvedAt?: string | null;
}) {
  const exportSections = input.sections.filter((s) => !s.internalOnly);
  const plainText = renderPlainText(exportSections);
  if (/\[INTERNAL\]|INTERNAL ONLY/i.test(plainText)) {
    throw new Error('INTERNAL_COMMENT_LEAK');
  }
  const manifest = buildExportManifest({
    noticePackageId: input.noticePackageId,
    draftRevisionId: input.draftRevisionId,
    revisionNumber: input.revisionNumber,
    language: input.language,
    generatorVersion: input.generatorVersion,
    plainTextBody: plainText,
    attachments: (input.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename,
      checksumSha256: a.checksumSha256,
      sequence: a.sequence,
    })),
    recipientPreparationIds: input.recipientPreparationIds ?? [],
    approvalDecisionId: input.approvalDecisionId,
    approvedAt: input.approvedAt,
  });
  const pdf = buildSimplePdf(input.title, plainText);
  const docx = buildSimpleDocx(input.title, plainText);
  const zip = buildAttachmentZip([
    { filename: 'notice.txt', content: Buffer.from(plainText, 'utf8') },
    { filename: 'manifest.json', content: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') },
    ...(input.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content })),
  ]);
  return {
    plainText,
    manifest,
    pdf,
    docx,
    zip,
    pdfChecksum: sha256Hex(pdf),
    docxChecksum: sha256Hex(docx),
    zipChecksum: sha256Hex(zip),
  };
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function zipStore(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    localParts.push(local, entry.data);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centralParts.push(central);
    offset += local.length + entry.data.length;
  }
  const localBlob = Buffer.concat(localParts);
  const centralBlob = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBlob.length, 12);
  end.writeUInt32LE(localBlob.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localBlob, centralBlob, end]);
}
