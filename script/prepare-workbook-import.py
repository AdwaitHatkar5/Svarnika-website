"""Prepare private staging CSVs from the workbook; never changes live data."""
import csv
import datetime as dt
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def read_workbook(path):
    with zipfile.ZipFile(path) as archive:
        strings = [''.join(t.itertext()) for t in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        relationships = {r.get('Id'): r.get('Target') for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        result = {}
        for sheet in ET.fromstring(archive.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS):
            target = relationships[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            root = ET.fromstring(archive.read('xl/' + target))
            rows = []
            for row in root.findall('m:sheetData/m:row', NS):
                values = {}
                for cell in row.findall('m:c', NS):
                    value = cell.find('m:v', NS)
                    text = value.text if value is not None else ''
                    if cell.get('t') == 's' and text:
                        text = strings[int(text)]
                    elif cell.get('t') == 'inlineStr':
                        text = ''.join(cell.find('m:is', NS).itertext())
                    if text:
                        values[re.sub(r'\d+', '', cell.get('r'))] = text
                if values:
                    rows.append((int(row.get('r')), values))
            result[sheet.get('name')] = rows
        return result


def write_csv(path, records, headers):
    with path.open('w', newline='', encoding='utf-8-sig') as stream:
        writer = csv.DictWriter(stream, fieldnames=headers)
        writer.writeheader()
        writer.writerows(records)


def prepare(source, destination):
    sheets = read_workbook(source)
    destination.mkdir(parents=True, exist_ok=True)
    inventory = []
    for row, cells in sheets['Inventory']:
        if row < 5 or not cells.get('C'):
            continue
        inventory.append(dict(sourceRow=row, proposedId=f'XLSX-{row:03}', sourceProductNumber=cells.get('AC', ''),
                              name=cells['C'], price=cells.get('AA', ''), discountedPrice=cells.get('AE', ''),
                              sourceStatus=cells.get('AM', ''), stock='', image='', metal='', weight=''))
    orders = []
    for name, rows in sheets.items():
        if not name.startswith('SVNJ'):
            continue
        starts = [i for i, (_, cells) in enumerate(rows) if cells.get('B', '').lower().startswith('name')]
        invoice_indices = [i for i, (_, cells) in enumerate(rows) if cells.get('G', '').startswith('Invoice No:')]
        previous = 0
        for part, index in enumerate(invoice_indices):
            end = invoice_indices[part + 1] if part + 1 < len(invoice_indices) else len(rows)
            # Stop at the next delivery label so two invoices on one tab stay separate.
            next_names = [i for i in starts if i > index + 4]
            if next_names and part + 1 < len(invoice_indices):
                end = next_names[0]
            before = rows[previous:index]
            after = rows[index:end]
            def labelled(records, label):
                matches = [v.split(':', 1)[1].strip() for _, c in records for v in c.values()
                           if re.match(label + r'\s*:', v, re.I)]
                return matches[-1] if matches else ''
            items = []
            for source_row, cells in after:
                if cells.get('C') and cells.get('E') and cells.get('G'):
                    items.append(dict(name=cells['C'], quantity=cells['E'], price=cells['G'],
                                      sourceLineTotal=cells.get('H', ''), sourceDiscount=cells.get('F', ''), sourceRow=source_row))
            totals = [cells['H'] for _, cells in after if re.match(r'Total Price\s*:', cells.get('B', ''), re.I) and cells.get('H')]
            final_values = [cells['G'] for _, cells in after if set(cells) == {'G'}]
            date = labelled(after, 'Invoice Date')
            created = dt.datetime.strptime(date, '%d-%m-%Y').date().isoformat() if date else ''
            orders.append(dict(sourceSheet=name, sourcePart=part + 1, orderId=labelled(after, 'Invoice No'),
                               createdAt=created, customerName=labelled(after, 'Name'),
                               deliverToName=labelled(before, 'Name'), customerPhone=labelled(before, 'Contact'),
                               customerAddress=labelled(after, 'Address'), total=final_values[-1] if final_values else totals[-1] if totals else '',
                               items=json.dumps(items, ensure_ascii=False), status='', paymentType='PRE-PAID',
                               shipmentId='', shipmentCompanyLink=''))
            previous = end
    assert len(inventory) == 46, f'Unexpected inventory count: {len(inventory)}'
    assert len(orders) == 16, f'Unexpected invoice count: {len(orders)}'
    write_csv(destination / 'inventory-review.csv', inventory, list(inventory[0]))
    write_csv(destination / 'orders-review.csv', orders, list(orders[0]))
    report = dict(inventoryRows=len(inventory), invoiceRecords=len(orders),
                  soldRows=sum(p['sourceStatus'] == 'SOLD' for p in inventory),
                  duplicateInvoiceIds=sorted({o['orderId'] for o in orders if sum(x['orderId'] == o['orderId'] for x in orders) > 1}),
                  conflictingNames=[o['sourceSheet'] for o in orders if o['customerName'].lower() != o['deliverToName'].lower()],
                  unresolved=['Stock quantities are absent; Number is not treated as quantity.',
                              'Confirm order IDs and customer names for conflicting invoice tabs.',
                              'No product image URLs or confirmed materials/weights in Inventory.',
                              'Hamper invoices include cost breakdowns; review before customer invoice use.',
                              'Live Google Sheet access is required for replacement.'])
    (destination / 'review.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    prepare(Path(sys.argv[1]), Path(sys.argv[2] if len(sys.argv) > 2 else '.local/workbook-import'))
