/** Trusted authored overlays on the rendered upright plane; never source SVG markup. */
export const CARD_GESTURE_PLANE = Object.freeze({ width: 1086, height: 1810 });
const fiveCardDetails = {
  sprout: {
    card: 'ace', x: .408, y: .34, rx: .17, ry: .30,
    frame: { x: .40, y: .30, zoom: 1.35 },
    spots: [
      { x: .408, y: .36, rx: .080, ry: .31 },
      { x: .369, y: .10, rx: .13, ry: .09 },
      { x: .355, y: .25, rx: .12, ry: .10 }
    ],
    traces: [
      'M443 1270 C442 1120 443 985 444 850 S447 585 449 465 S449 285 451 230'
    ]
  },
  castle: {
    card: 'ace', x: .200, y: .721, rx: .075, ry: .072,
    frame: { x: .20, y: .72, zoom: 1.65 }
  },
  carried: {
    card: 'swords', x: .465, y: .434, rx: .255, ry: .235,
    frame: { x: .45, y: .43, zoom: 1.15 }
  },
  'two-swords': {
    card: 'swords', x: .748, y: .601, rx: .13, ry: .24,
    frame: { x: .748, y: .601, zoom: 1.30 },
    spots: [
      { x: .696, y: .601, rx: .061, ry: .24 },
      { x: .800, y: .587, rx: .061, ry: .24 }
    ],
    traces: [
      'M758 1442 L760 888',
      'M867 1437 L868 843'
    ]
  },
  cup: {
    card: 'queen', x: .334, y: .372, rx: .14, ry: .145,
    frame: { x: .34, y: .38, zoom: 1.40 }
  },
  collaborators: {
    card: 'pentacles', x: .53, y: .54, rx: .39, ry: .24,
    frame: { x: .53, y: .53, zoom: 1.12 },
    spots: [
      { x: .52, y: .49, rx: .38, ry: .20 },
      { x: .541, y: .602, rx: .18, ry: .13 }
    ]
  },
  wheel: {
    card: 'wheel', x: .484, y: .506, rx: .31, ry: .193,
    frame: { x: .484, y: .506, zoom: 1.12 },
    traces: ['M700 1063 A229 231 0 0 1 639 1114']
  }
};
const rivulets = [
  "M 922 1465 C 916.9 1465 878.2 1463.5 871 1465 C 863.8 1466.5 859.8 1478.3 850 1480 C 840.2 1481.7 781.4 1481.4 773 1482 C 764.6 1482.6 768.5 1485.3 766 1486 C 763.5 1486.7 750.9 1488.2 748 1489 C 745.1 1489.8 739.9 1493.3 737 1494 C 734.1 1494.7 721.5 1495.4 719 1496 C 716.5 1496.6 714.9 1499.4 712 1500 C 709.1 1500.6 694 1500.7 690 1502 C 686 1503.3 676.1 1511.3 672 1513 C 667.9 1514.7 652.4 1517.2 649 1519 C 645.6 1520.8 640.5 1529.7 638 1531 C 635.5 1532.3 625.8 1531.6 624 1532 C 622.2 1532.4 620.4 1534.7 620 1535",
  "M 922 1465 C 917.1 1465 880.7 1462.2 873 1465 C 865.3 1467.8 847.8 1489.5 845 1493 C 842.2 1496.5 845.7 1498.5 845 1500 C 844.3 1501.5 841.9 1506.5 838 1508 C 834.1 1509.5 810.2 1513.5 806 1515 C 801.8 1516.5 797.5 1522.2 796 1523 C 794.5 1523.8 793 1521.5 791 1523 C 789 1524.5 779.2 1536.1 776 1538 C 772.8 1539.9 761.8 1540.1 759 1542 C 756.2 1543.9 751.5 1554.9 748 1557 C 744.5 1559.1 727.3 1561.4 724 1563 C 720.7 1564.6 716.4 1572 715 1573 C 713.6 1574 711 1572.5 710 1573 C 709 1573.5 705.6 1576.3 705 1578 C 704.4 1579.7 704.5 1588.2 704 1590 C 703.5 1591.8 700.7 1594 700 1596 C 699.3 1598 699 1606.8 697 1610 C 695 1613.2 681.7 1625.3 680 1628 C 678.3 1630.7 680 1636.1 680 1637",
  "M 966 1426 C 981 1429 1001 1420 1023 1422",
  "M 922 1465 C 922.3 1464.7 920.5 1462.3 925 1462 C 929.5 1461.7 961.8 1461.5 967 1462 C 972.2 1462.5 973.9 1466.1 977 1467 C 980.1 1467.9 993.1 1470.9 998 1471 C 1002.9 1471.1 1023.2 1468.3 1026 1468",
  "M 953 1505 C 954.5 1507.2 954.2 1508.3 953 1510 C 951.8 1511.7 944.2 1520.1 941 1522 C 937.8 1523.9 924.3 1527 921 1529 C 917.7 1531 909.3 1539.4 908 1542 C 906.7 1544.6 907 1552.7 908 1555 C 909 1557.3 915.1 1563.8 918 1565 C 920.9 1566.2 933.9 1565.9 937 1567 C 940.1 1568.1 947.1 1575.5 949 1576 M 961 1572 C 962.9 1573.7 973.1 1586.2 975 1589 C 976.9 1591.8 977.5 1596.9 980 1600 C 982.5 1603.1 998 1616.5 1000 1620 C 1002 1623.5 1000 1633.5 1000 1635"
];
const poolWater = {
  kind: 'water', clips: {
    stream: 'M 252 1215 C 265 1205 295 1205 304 1220 C 312 1260 308 1330 304 1435 C 290 1445 270 1445 260 1435 C 255 1330 248 1260 252 1215 Z',
    pool: 'M 50 1250 Q 200 1255 350 1265 C 375 1270 380 1285 395 1300 L 400 1340 L 420 1370 L 475 1380 L 520 1350 L 550 1310 C 580 1315 620 1340 645 1390 C 675 1450 660 1490 620 1520 C 560 1560 480 1590 320 1615 L 50 1615 Z'
  },
  streams: ['M264 1210 C275 1260 268 1340 268 1435', 'M276 1212 C286 1265 280 1345 282 1440', 'M288 1215 C296 1265 292 1345 293 1440', 'M298 1220 C305 1270 302 1350 300 1435'],
  ripples: [{ cx: 285, cy: 1455, rx: 260, ry: 115 }]
};
const landWater = {
  kind: 'water', clips: { stream: 'M 902 995 C 915 990 925 990 932 998 C 938 1030 940 1200 935 1475 C 920 1485 898 1485 888 1475 C 885 1200 892 1030 902 995 Z' },
  streams: ['M906 1000 L903 1475', 'M916 995 L915 1480', 'M926 1000 L928 1475'],
  rivulets, rivuletMaskWidth: 14
};
function detail(id, terms, maskSpots, frame, motionRecipe, traces = []) {
  return { id, terms, maskSpots, spots: maskSpots.map(({ x, y, rx }) => [x, y, rx]), frame, traces, motionRecipe };
}
const vectorDetails = {
  'The Star': [
    detail('pool-pour', ['pool', 'pitcher into a pool', 'memory', 'people back home'], [{ x: .275, y: .70, rx: .18, ry: .16 }], { x: .275, y: .70, zoom: 1.4 }, poolWater),
    detail('land-pour', ['land', 'pitcher onto the land', 'new ground'], [{ x: .84, y: .65, rx: .14, ry: .22 }], { x: .84, y: .725, zoom: 1.05 }, landWater)
  ],
  'The Hermit': [detail('lantern', ['lantern', 'next few steps'], [{ x: .15, y: .232, rx: .16, ry: .13 }], { x: .15, y: .232, zoom: 2.3 })],
  'Five of Wands': [detail('staffs', ['staffs', 'scrum', 'wands'], [{ x: .5, y: .51, rx: .48, ry: .36 }], { x: .5, y: .49, zoom: 1.08 })]
};
const cardNames = { ace: 'Ace of Wands', swords: 'Seven of Swords', queen: 'Queen of Cups', pentacles: 'Three of Pentacles', wheel: 'Wheel of Fortune' };
for (const [id, authored] of Object.entries(fiveCardDetails)) {
  const { card, x, y, rx, ry, spots, frame, traces = [] } = authored;
  (vectorDetails[cardNames[card]] ||= []).push(detail(id, [id.replaceAll('-', ' ')], spots || [{ x, y, rx, ry }], frame, traces.length ? { kind: 'finite', duration: 1800 } : undefined, traces));
}
/** Unsupported cards deliberately keep whole-card context without scan geometry. */
export function getVectorGestureDetails(canonicalName) {
  return vectorDetails[canonicalName] || [];
}
/** Crop coordinates are upright; rotate once with the common artwork plane. */
export function projectGestureFrame(frame, reversed = false) {
  if (!frame) return undefined;
  return { ...frame, x: reversed ? 1 - frame.x : frame.x, y: reversed ? 1 - frame.y : frame.y };
}
