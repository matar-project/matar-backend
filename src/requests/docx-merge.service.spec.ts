import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import JSZip from 'jszip';
import { DocxMergeService } from './docx-merge.service';

async function createDocx(path: string, text: string) {
  const archive = new JSZip();
  archive.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
  );
  archive.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p><w:sectPr /></w:body>
      </w:document>`,
  );
  await writeFile(path, await archive.generateAsync({ type: 'nodebuffer' }));
}

describe('DocxMergeService', () => {
  const service = new DocxMergeService();
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'matar-docx-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('merges Word parts by their starting page', async () => {
    const laterPart = join(directory, 'later.docx');
    const firstPart = join(directory, 'first.docx');
    await createDocx(laterPart, 'pages 11 to 20');
    await createDocx(firstPart, 'pages 1 to 10');

    const merged = await service.merge([
      { path: laterPart, startPage: 11 },
      { path: firstPart, startPage: 1 },
    ]);

    try {
      const archive = await JSZip.loadAsync(await readFile(merged.outputPath));
      const document = await archive.file('word/document.xml')!.async('string');
      expect(document.indexOf('pages 1 to 10')).toBeLessThan(
        document.indexOf('pages 11 to 20'),
      );
    } finally {
      await rm(merged.outputPath, { force: true });
    }
  });

  it('rejects files that are not valid docx archives', async () => {
    const invalidFile = join(directory, 'invalid.docx');
    await writeFile(invalidFile, 'not a docx');

    await expect(service.validate(invalidFile)).rejects.toThrow(
      'The uploaded file is not a valid .docx',
    );
  });
});
