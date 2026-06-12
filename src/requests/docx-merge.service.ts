import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { copyFile, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Element as XmlElement, Node as XmlNode } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { REQUEST_OUTPUT_DIRECTORY } from './request-output-upload.config';

const WORD_NAMESPACE =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

type DocxPart = {
  path: string;
  startPage: number;
};

@Injectable()
export class DocxMergeService {
  async validate(path: string) {
    try {
      const archive = await JSZip.loadAsync(await readFile(path));
      if (!archive.file('word/document.xml')) {
        throw new Error('word/document.xml is missing');
      }
    } catch {
      throw new BadRequestException('The uploaded file is not a valid .docx');
    }
  }

  async merge(parts: DocxPart[]) {
    if (parts.length === 0) {
      throw new BadRequestException('No Word files are available to merge');
    }

    const orderedParts = [...parts].sort(
      (left, right) => left.startPage - right.startPage,
    );
    const outputStoredName = `${randomUUID()}.docx`;
    const outputPath = join(REQUEST_OUTPUT_DIRECTORY, outputStoredName);

    if (orderedParts.length === 1) {
      await copyFile(orderedParts[0].path, outputPath);
      return { outputPath, outputStoredName };
    }

    try {
      const baseArchive = await JSZip.loadAsync(
        await readFile(orderedParts[0].path),
      );
      const baseDocument = await this.readDocument(baseArchive);
      const baseBody = baseDocument.getElementsByTagNameNS(
        WORD_NAMESPACE,
        'body',
      )[0];
      if (!baseBody) throw new Error('Word document body is missing');

      const sectionProperties = this.findDirectSectionProperties(baseBody);
      if (sectionProperties) baseBody.removeChild(sectionProperties);

      for (const part of orderedParts.slice(1)) {
        const archive = await JSZip.loadAsync(await readFile(part.path));
        const document = await this.readDocument(archive);
        const body = document.getElementsByTagNameNS(WORD_NAMESPACE, 'body')[0];
        if (!body) throw new Error('Word document body is missing');

        for (const node of Array.from(body.childNodes)) {
          if (node.nodeType === 1 && node.localName === 'sectPr') {
            continue;
          }
          baseBody.appendChild(baseDocument.importNode(node, true));
        }
      }

      if (sectionProperties) baseBody.appendChild(sectionProperties);
      baseArchive.file(
        'word/document.xml',
        new XMLSerializer().serializeToString(baseDocument),
      );
      await writeFile(
        outputPath,
        await baseArchive.generateAsync({ type: 'nodebuffer' }),
      );
      return { outputPath, outputStoredName };
    } catch {
      await unlink(outputPath).catch(() => undefined);
      throw new BadRequestException(
        'The Word files could not be combined. Ensure every upload is a valid .docx file.',
      );
    }
  }

  private async readDocument(archive: JSZip) {
    const documentFile = archive.file('word/document.xml');
    if (!documentFile) throw new Error('word/document.xml is missing');
    return new DOMParser().parseFromString(
      await documentFile.async('string'),
      'application/xml',
    );
  }

  private findDirectSectionProperties(body: XmlElement): XmlNode | undefined {
    return Array.from(body.childNodes).find(
      (node) => node.nodeType === 1 && node.localName === 'sectPr',
    );
  }
}
