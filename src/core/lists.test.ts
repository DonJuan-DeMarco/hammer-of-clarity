import { describe, expect, it } from 'vitest';
import { listDomain, parseDomainList } from './lists';

describe('parseDomainList', () => {
  it('reads every supported line format and drops comments, junk and duplicates', () => {
    const text = [
      '# Title: some list',
      '! adblock comment',
      '',
      'plain.example',
      '*.wild.example',
      '0.0.0.0 hosts.example',
      '127.0.0.1   hosts-two.example  # trailing comment',
      '||adblock.example^',
      '||with-options.example^$third-party',
      'UPPER.Example',
      'plain.example',
      '0.0.0.0 0.0.0.0',
      '127.0.0.1 localhost',
      'not a domain at all',
      'no-dot',
      'bücher.example',
      '   spaced.example   ',
    ].join('\n');

    expect(parseDomainList(text)).toEqual([
      'plain.example',
      'wild.example',
      'hosts.example',
      'hosts-two.example',
      'adblock.example',
      'with-options.example',
      'upper.example',
      'xn--bcher-kva.example',
      'spaced.example',
    ]);
  });

  it('keeps www. as listed: lists name exactly what to block', () => {
    expect(parseDomainList('www.only-www.example')).toEqual(['www.only-www.example']);
  });

  it('handles Windows line endings', () => {
    expect(parseDomainList('a.example\r\nb.example\r\n')).toEqual(['a.example', 'b.example']);
  });
});

describe('listDomain', () => {
  it('rejects addresses and labels with bad characters', () => {
    expect(listDomain('192.168.0.1')).toBeNull();
    expect(listDomain('bad_label!.example')).toBeNull();
    expect(listDomain('-leading.example')).toBeNull();
  });
});
