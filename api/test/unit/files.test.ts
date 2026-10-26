import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFileType, sanitizeFileName, isImage } from '../../src/utils/files.js';

test('detects a PDF from magic bytes even when the declared MIME type is wrong', () => {
  const buffer = Buffer.from('%PDF-1.7\n% test\n', 'latin1');
  assert.equal(detectFileType(buffer, 'image/png'), 'pdf');
});

test('does not trust a declared PDF MIME type without the signature', () => {
  const buffer = Buffer.from('this is not a pdf', 'utf8');
  assert.equal(detectFileType(buffer, 'application/pdf'), 'unknown');
});

test('detects PNG and JPEG signatures', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  assert.equal(detectFileType(png), 'png');
  assert.equal(detectFileType(jpeg), 'jpeg');
  assert.equal(isImage('png'), true);
  assert.equal(isImage('jpeg'), true);
  assert.equal(isImage('pdf'), false);
});

test('accepts UTF-8 text only when it is declared as plain text', () => {
  const buffer = Buffer.from('Metformin 500 mg twice daily', 'utf8');
  assert.equal(detectFileType(buffer, 'text/plain'), 'text');
  assert.equal(detectFileType(buffer, 'application/octet-stream'), 'unknown');
});

test('rejects binary content that pretends to be text', () => {
  const buffer = Buffer.from([0x4d, 0x00, 0x45, 0x00, 0x54]);
  assert.equal(detectFileType(buffer, 'text/plain'), 'unknown');
});

test('sanitises uploaded file names and strips directory traversal', () => {
  assert.equal(sanitizeFileName('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFileName('C:\\temp\\my report.pdf'), 'my report.pdf');
  assert.equal(sanitizeFileName('...hidden.txt'), 'hidden.txt');
  assert.equal(sanitizeFileName(undefined), 'document');
});
