#!/usr/bin/env python3
"""Fetch original Commons SVGs, resume by SHA-1, and inventory their contents."""

import argparse
import datetime
import gzip
import hashlib
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CATEGORY = 'Category:Vectorized Tarot by Immanuelle'
API = 'https://commons.wikimedia.org/w/api.php'
USER_AGENT = 'TableuReadingStudy/1.0 (Commons original artwork asset acquisition)'
PRIORITY = ['major-17-star.svg', 'major-09-hermit.svg', 'major-16-tower.svg', 'wands-05.svg', 'cups-06.svg']
RANKS = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King']
MAJORS = ['Fool', 'Magician', 'High Priestess', 'Empress', 'Emperor', 'Hierophant', 'Lovers', 'Chariot',
          'Strength', 'Hermit', 'Wheel of Fortune', 'Justice', 'Hanged Man', 'Death', 'Temperance',
          'Devil', 'Tower', 'Star', 'Moon', 'Sun', 'Judgement', 'World']
STATUS_PATH = ROOT / 'download-status.json'


class SourceCooldown(RuntimeError):
    pass


def check_cooldown():
    if STATUS_PATH.exists():
        status = json.loads(STATUS_PATH.read_text())
        remaining = status.get('retry_at_unix', 0) - time.time()
        if remaining > 0:
            raise SourceCooldown(f'Source cooldown active for another {int(remaining) + 1} seconds; no request sent')


def request(url):
    """One request at a time; bounded retries respect Retry-After."""
    check_cooldown()
    for attempt in range(2):
        try:
            # The API adds analytics parameters. Prefer the canonical original
            # on the first request; either URL must match the same SHA-1/bytes.
            is_original = url.startswith('https://upload.wikimedia.org/')
            target = urllib.parse.urlsplit(url)._replace(query='').geturl() if is_original and not attempt else url
            started = time.time()
            with urllib.request.urlopen(urllib.request.Request(target, headers={'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip'}), timeout=90) as response:
                data = response.read()
                decoded = gzip.decompress(data) if response.headers.get('Content-Encoding') == 'gzip' else data
                if is_original:
                    headers = {key: value for key, value in response.headers.items() if key.lower() in ('content-type', 'content-length', 'content-encoding', 'last-modified', 'date', 'age', 'x-cache', 'server')}
                    transfer = {'url': target, 'retrieved_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                                'received_bytes': len(data), 'decoded_bytes': len(decoded),
                                'elapsed_seconds': round(time.time() - started, 3), 'headers': headers}
                    with (ROOT / 'transfer-log.jsonl').open('a') as log:
                        log.write(json.dumps(transfer) + '\n')
                return decoded
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
            code = getattr(error, 'code', None)
            if code == 429:
                headers = {key: value for key, value in error.headers.items() if key.lower() in ('retry-after', 'server', 'content-type', 'x-cache', 'age', 'date', 'content-length', 'content-encoding')}
                body = error.read(5000).decode('utf-8', 'replace')
                body = plain(re.sub(r'<style.*?</style>', '', body, flags=re.S | re.I))
                body = re.sub(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', '[network address]', body)
                body = re.sub(r'IP address:.*', 'IP address: [redacted]', body, flags=re.S | re.I)
                print('429 diagnostic: ' + json.dumps({'headers': headers, 'body': re.sub(r'\s+', ' ', body)[:700]}), flush=True)
            if code not in (None, 429, 500, 502, 503, 504):
                raise
            retry = getattr(error, 'headers', {}).get('Retry-After', '')
            delay = max(15, int(retry)) if str(retry).isdigit() else min(60, 15 * 2 ** attempt)
            if code == 429:
                STATUS_PATH.write_text(json.dumps({'status': 'source-cooldown', 'retry_at_unix': time.time() + delay,
                                                   'retry_after_seconds': delay, 'headers': headers}, indent=2) + '\n')
            if delay > 120:
                raise SourceCooldown(f'Source requested {delay}s cooldown; stopping all download requests for this run') from error
            print(f'Retrying after {delay}s: {code or type(error).__name__}', flush=True)
            time.sleep(delay)
            if attempt == 1:
                raise


def fetch_metadata():
    pages = []
    params = {'action': 'query', 'format': 'json', 'formatversion': '2',
              'generator': 'categorymembers', 'gcmtitle': CATEGORY, 'gcmtype': 'file',
              'gcmlimit': '100', 'prop': 'imageinfo', 'iiprop': 'url|size|sha1|extmetadata|timestamp',
              'iiextmetadatalanguage': 'en'}
    while True:
        result = json.loads(request(API + '?' + urllib.parse.urlencode(params)))
        if 'error' in result:
            raise RuntimeError(result['error'])
        pages.extend(result['query']['pages'])
        if 'continue' not in result:
            return pages
        params.update(result['continue'])


def identify(title):
    major = re.fullmatch(r'File:RWS Tarot (\d{2}) (.+)\.svg', title)
    if major:
        number, name = major.groups()
        if not 0 <= int(number) < len(MAJORS) or name != MAJORS[int(number)]:
            raise ValueError('Unrecognized major arcana identity: ' + title)
        return {'id': 'major-' + number, 'name': name, 'arcana': 'major', 'suit': None,
                'rank': int(number), 'filename': 'major-' + number + '-' + name.lower().replace(' ', '-') + '.svg'}
    minor = re.fullmatch(r'File:(Cups|Pents|Swords|Wands)(\d{2})\.svg', title)
    if minor:
        source_suit, number = minor.groups()
        suit = {'Cups': 'cups', 'Pents': 'pentacles', 'Swords': 'swords', 'Wands': 'wands'}[source_suit]
        rank = int(number)
        if not 1 <= rank <= 14:
            raise ValueError(title)
        return {'id': f'{suit}-{number}', 'name': f'{RANKS[rank - 1]} of {suit.title()}',
                'arcana': 'minor', 'suit': suit, 'rank': rank, 'filename': f'{suit}-{number}.svg'}
    if title == 'File:Waite–Smith Tarot Roses and Lilies cropped.svg':
        return {'id': 'back', 'name': 'Roses and Lilies card back', 'arcana': None, 'suit': None,
                'rank': None, 'filename': 'back.svg'}
    raise ValueError('Unrecognized category member: ' + title)


def plain(value):
    return html.unescape(re.sub('<[^>]+>', '', str(value))).strip()


def inspect_svg(data):
    result = {'xml_parses': False, 'scripts': [], 'event_handlers': [], 'foreign_objects': [],
              'external_references': [], 'embedded_images': [], 'declarations': [], 'element_counts': {}}
    text = data.decode('utf-8')
    result['declarations'] = re.findall(r'<!DOCTYPE[^>]+>', text, re.I)
    # ElementTree does not resolve the standard SVG external DTD. Reject entity
    # declarations before parsing, and retain any DOCTYPE as an explicit finding.
    if re.search(r'<!\s*ENTITY\b', text, re.I):
        result['declarations'].append('ENTITY declaration: parsing intentionally skipped')
        result['safe_for_image_use'] = False
        return result
    try:
        root = ET.fromstring(data)
    except ET.ParseError as error:
        result['parse_error'] = str(error)
        result['safe_for_image_use'] = False
        return result
    result['xml_parses'] = True
    result['svg_root'] = root.tag == '{http://www.w3.org/2000/svg}svg'
    result['view_box'] = root.attrib.get('viewBox')
    tags = Counter()
    for element in root.iter():
        tag = element.tag.rsplit('}', 1)[-1]
        tags[tag] += 1
        if tag.lower() == 'script':
            result['scripts'].append(element.attrib.get('id', '(unnamed)'))
        if tag.lower() == 'foreignobject':
            result['foreign_objects'].append(element.attrib.get('id', '(unnamed)'))
        if tag.lower() == 'image':
            result['embedded_images'].append(element.attrib.get('id', '(unnamed)'))
        for key, value in element.attrib.items():
            local = key.rsplit('}', 1)[-1]
            if local.lower().startswith('on'):
                result['event_handlers'].append(f'{tag}:{local}')
            if local.lower() in ('href', 'src') and value and not value.startswith('#'):
                result['external_references'].append(f'{tag}:{local}={value}')
            for match in re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', value, re.I):
                if not match.strip().startswith('#'):
                    result['external_references'].append(f'{tag}:{local}:url({match})')
        if tag.lower() == 'style':
            css = element.text or ''
            if '@import' in css.lower():
                result['external_references'].append('style:@import')
            for match in re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', css, re.I):
                if not match.strip().startswith('#'):
                    result['external_references'].append(f'style:url({match})')
    result['element_counts'] = dict(sorted(tags.items()))
    result['safe_for_image_use'] = result['svg_root'] and not any(result[key] for key in (
        'scripts', 'event_handlers', 'foreign_objects', 'external_references'))
    return result


def checksum_matches(data, info):
    return len(data) == info['size'] and hashlib.sha1(data).hexdigest() == info['sha1']


def source_entry(card, page, info):
    ext = info['extmetadata']
    value = lambda key: plain(ext.get(key, {}).get('value', ''))
    return {**card, 'source_title': page['title'], 'description_url': info['descriptionurl'],
            'original_url': info['url'], 'source_timestamp': info['timestamp'],
            'license': value('LicenseShortName'), 'license_code': value('License'),
            'license_url': value('LicenseUrl'), 'usage_terms': value('UsageTerms'),
            'attribution_required': value('AttributionRequired'), 'artist': value('Artist'),
            'vectorization_credit': 'Immanuelle; vectorizer.com followed by Inkscape editing (source description)',
            'credit': value('Credit'), 'description': value('ImageDescription'),
            'width': info['width'], 'height': info['height'], 'bytes': info['size'],
            'sha1': info['sha1'], 'sha256': None, 'available': False, 'validation': None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true', help='Verify local bytes and regenerate manifest using cached metadata; no network')
    parser.add_argument('--refresh-metadata', action='store_true', help='Refresh the complete Commons category metadata before downloading')
    parser.add_argument('--interval', type=float, default=60, help='Seconds between original-file transfers (default: 60)')
    parser.add_argument('--reuse-dir', type=Path, help='Optional directory of existing originals to consider by SHA-1 (never modifies that directory)')
    args = parser.parse_args()
    if args.interval < 3:
        parser.error('--interval must be at least 3 seconds')
    metadata_path = ROOT / 'commons-metadata.json'
    if args.verify_only or (metadata_path.exists() and not args.refresh_metadata):
        metadata = json.loads(metadata_path.read_text())
    else:
        metadata = {'retrieved_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pages': fetch_metadata()}
        metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    pages = metadata['pages']
    identities = [identify(page['title']) for page in pages]
    counts = Counter(card['suit'] or card['arcana'] or 'back' for card in identities)
    expected = {'major': 22, 'cups': 14, 'pentacles': 14, 'swords': 14, 'wands': 14, 'back': 1}
    if (dict(counts) != expected or len({card['filename'] for card in identities}) != 79
            or len({card['id'] for card in identities}) != 79
            or {card['rank'] for card in identities if card['arcana'] == 'major'} != set(range(22))):
        raise RuntimeError('Category completeness or uniqueness mismatch: ' + repr(dict(counts)))
    reuse = {}
    if args.reuse_dir:
        for candidate in args.reuse_dir.glob('*vector*.svg'):
            reuse[hashlib.sha1(candidate.read_bytes()).hexdigest()] = candidate
    def order(page):
        name = identify(page['title'])['filename']
        return (PRIORITY.index(name) if name in PRIORITY else len(PRIORITY), name)
    entries, errors = [], []
    for index, page in enumerate(sorted(pages, key=order), 1):
        card = identify(page['title'])
        info = page['imageinfo'][0]
        destination = ROOT / card['filename']
        entry = source_entry(card, page, info)
        downloaded = False
        try:
            data = destination.read_bytes() if destination.exists() else b''
            if not checksum_matches(data, info):
                if args.verify_only:
                    raise RuntimeError('Missing or nonmatching local bytes')
                reused = reuse.get(info['sha1'])
                data = reused.read_bytes() if reused else request(info['url'])
                if not checksum_matches(data, info):
                    raise RuntimeError('Downloaded bytes do not match Commons SHA-1/size')
                temporary = destination.with_suffix('.svg.part')
                temporary.write_bytes(data)
                temporary.replace(destination)
                downloaded = not bool(reused)
            entry.update({'sha256': hashlib.sha256(data).hexdigest(), 'available': True, 'validation': inspect_svg(data)})
            print(f'{index}/79 {card["filename"]}: verified, {len(data)} bytes, safe_image={entry["validation"]["safe_for_image_use"]}', flush=True)
        except Exception as error:
            errors.append({'filename': card['filename'], 'error': str(error)})
            print(f'{index}/79 FAILED {card["filename"]}: {error}', flush=True)
        entries.append(entry)
        if downloaded and index < len(pages):
            time.sleep(args.interval)
    entries.sort(key=lambda item: item['filename'])
    available = [entry for entry in entries if entry['available']]
    manifest = {'schema_version': 1, 'deck': 'Rider–Waite–Smith vectorized by Immanuelle',
                'category': CATEGORY, 'category_url': 'https://commons.wikimedia.org/wiki/Category:Vectorized_Tarot_by_Immanuelle',
                'metadata_retrieved_at': metadata['retrieved_at'],
                'verified_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'original_bytes_preserved': True, 'expected_counts': expected, 'source_counts': dict(counts),
                'file_count': len(available), 'expected_file_count': 79, 'total_bytes': sum(entry['bytes'] for entry in available),
                'all_files_present': len(available) == 79, 'all_xml_parse': len(available) == 79 and all(entry['validation']['xml_parses'] for entry in available),
                'all_safe_for_image_use': len(available) == 79 and all(entry['validation']['safe_for_image_use'] for entry in available),
                'validation_note': 'Static XML inspection only; SVG source bytes are preserved. External-reference checks cover href/src, CSS url() and @import; XML namespace and RDF attribution identifiers are not executable references.',
                'errors': errors, 'cards': entries}
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: manifest[key] for key in ('file_count', 'total_bytes', 'all_files_present', 'all_xml_parse', 'all_safe_for_image_use')}), flush=True)
    if len(available) == 79:
        STATUS_PATH.write_text(json.dumps({'status': 'complete', 'file_count': 79}, indent=2) + '\n')
    if errors or not manifest['all_safe_for_image_use']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
